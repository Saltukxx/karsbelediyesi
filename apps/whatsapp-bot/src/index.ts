import path from "path";
import { fileURLToPath } from "url";
import { mkdir } from "fs/promises";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@kars/db";
import { processInbound, type InboundJob } from "./process.js";
import { setSendAdapter, sendText } from "./send.js";
import { writeStatus } from "./status.js";
import {
  detectInboundMedia,
  downloadAndSaveMedia,
  MEDIA_DIR,
  placeholderIcerik,
  type MediaErrorCode,
} from "./media.js";

const AUTH_DIR = path.join(__dirname, "../data/auth");
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  await mkdir(AUTH_DIR, { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeStatus({ connected: false, qrPending: false });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<InboundJob>("whatsapp-inbound", { connection });

  let sock: WASocket | null = null;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  setSendAdapter({
    sendText: async (to, text) => {
      if (!sock) throw new Error("Socket yok");
      const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text });
      await prisma.whatsAppMessage.create({
        data: { telefon: to.replace(/\D/g, ""), yon: "GIDEN", icerik: text },
      });
    },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection: conn, lastDisconnect, qr } = update;
    if (qr) {
      console.log("WhatsApp QR — telefonunuzla tarayın:");
      qrcode.generate(qr, { small: true });
      await writeStatus({ connected: false, qrPending: true });
    }
    if (conn === "open") {
      console.log("WhatsApp bağlantısı açık");
      await writeStatus({ connected: true, qrPending: false });
    }
    if (conn === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      await writeStatus({ connected: false, qrPending: false });
      console.log("Bağlantı kapandı", code, shouldReconnect ? "— yeniden bağlanılıyor" : "");
      if (shouldReconnect) {
        setTimeout(() => main().catch(console.error), 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const jid = m.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;
      const telefon = jid.replace(/@.*$/, "").replace(/\D/g, "");
      const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        "";
      const detected = detectInboundMedia(m.message);
      if (!text && !detected) continue;

      const waMessageId = m.key.id ?? undefined;
      const job: InboundJob = {
        telefon,
        icerik: text || (detected ? placeholderIcerik(detected.medyaTipi) : "(medya)"),
        waMessageId,
      };

      if (detected && waMessageId) {
        try {
          const saved = await downloadAndSaveMedia(m, waMessageId, detected);
          job.medyaUrl = saved.medyaUrl;
          job.medyaTipi = saved.medyaTipi;
          job.mimeType = saved.mimeType;
        } catch (err) {
          const code = (err as { code?: MediaErrorCode }).code;
          job.medyaTipi = detected.medyaTipi;
          job.mimeType = detected.mimeType;
          job.mediaError =
            code === "too_large" ? "too_large" : "download_failed";
          console.error("Medya indirme hatası", waMessageId, err);
        }
      } else if (detected && !waMessageId) {
        job.medyaTipi = detected.medyaTipi;
        job.mimeType = detected.mimeType;
        job.mediaError = "download_failed";
      }

      await queue.add("inbound", job, {
        jobId: waMessageId,
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }
  });

  new Worker<InboundJob>(
    "whatsapp-inbound",
    async (job) => {
      const result = await processInbound(job.data);
      if (!result.skipped) {
        await sendText(job.data.telefon, result.reply);
      }
      return result;
    },
    { connection, concurrency: 1 },
  );

  console.log("WhatsApp bot çalışıyor. Redis:", REDIS_URL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
