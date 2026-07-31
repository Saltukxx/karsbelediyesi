import path from "path";
import { fileURLToPath } from "url";
import { mkdir } from "fs/promises";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@kars/db";
import { processInbound, type InboundJob } from "./process.js";
import { setSendAdapter, sendText } from "./send.js";
import { sonDenemeMi } from "./outbound-state.js";
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
const RECONNECT_MIN_MS = 3_000;
const RECONNECT_MAX_MS = 30_000;

/** Panelden kuyruğa atılan giden mesaj (web tarafındaki tanımla senkron tutulmalı) */
export type OutboundJob = {
  telefon: string;
  text: string;
  complaintId?: string;
  sentByUserId?: string;
  /** Panelde oluşturulan WhatsAppMessage satırının idempotency anahtarı */
  outboundKey?: string;
};

/**
 * Aktif socket tek referansta tutulur: worker'lar ve gönderim adaptörü
 * bunu okur, yeniden bağlanma eskisini kapatıp bu referansı değiştirir.
 */
let sock: WASocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectGecikme = RECONNECT_MIN_MS;
let queue: Queue<InboundJob>;

/**
 * Oturum açılmadan sendMessage çağrılırsa Baileys anlaşılmaz bir hata verir
 * (creds.me okunamaz); burada anlamlı ve yeniden denenebilir hata fırlatılır.
 */
function aktifSocket(): WASocket {
  if (!sock?.user) throw new Error("WhatsApp bağlantısı yok (oturum açılmadı)");
  return sock;
}

function jidOf(telefon: string): string {
  return telefon.includes("@")
    ? telefon
    : `${telefon.replace(/\D/g, "")}@s.whatsapp.net`;
}

/** Süreç boyunca bir kez: dizinler, Redis, kuyruk ve worker'lar */
async function bootstrap() {
  await mkdir(AUTH_DIR, { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeStatus({ connected: false, qrPending: false });

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue<InboundJob>("whatsapp-inbound", { connection });

  setSendAdapter({
    sendText: async (to, text) => {
      await aktifSocket().sendMessage(jidOf(to), { text });
      await prisma.whatsAppMessage.create({
        data: { telefon: to.replace(/\D/g, ""), yon: "GIDEN", icerik: text },
      });
    },
  });

  new Worker<InboundJob>("whatsapp-inbound", inboundIsle, {
    connection,
    concurrency: 1,
  });

  // Panelden vatandaşa gönderilen mesajlar (personel cevapları)
  new Worker<OutboundJob>("whatsapp-outbound", outboundIsle, {
    connection,
    concurrency: 1,
  });

  console.log("WhatsApp bot çalışıyor. Redis:", REDIS_URL);
}

async function inboundIsle(job: Job<InboundJob>) {
  const result = await processInbound(job.data);
  if (result.skipped) return result;

  await sendText(job.data.telefon, result.reply);
  if (result.messageId) {
    await prisma.whatsAppMessage.update({
      where: { id: result.messageId },
      data: { yanitGonderildi: true },
    });
  }
  return result;
}

/**
 * Giden mesaj tek sefer gönderilir: panel satırı zaten GONDERILDI ise job
 * hiç göndermeden biter, aksi halde gönderim sonrası satır işaretlenir.
 * Son deneme de başarısızsa satır BASARISIZ işaretlenir; aksi halde mesaj
 * panelde sonsuza kadar "kuyrukta" görünürdü.
 */
async function outboundIsle(job: Job<OutboundJob>) {
  const { telefon, text, complaintId, sentByUserId, outboundKey } = job.data;
  const temiz = telefon.replace(/\D/g, "");

  const kayit = outboundKey
    ? await prisma.whatsAppMessage.findUnique({ where: { outboundKey } })
    : null;
  if (kayit?.gonderimDurumu === "GONDERILDI") return { skipped: true };

  let sent: Awaited<ReturnType<WASocket["sendMessage"]>>;
  try {
    sent = await aktifSocket().sendMessage(jidOf(temiz), { text });
  } catch (err) {
    if (kayit && sonDenemeMi(job)) {
      await prisma.whatsAppMessage.update({
        where: { id: kayit.id },
        data: { gonderimDurumu: "BASARISIZ" },
      });
    }
    throw err;
  }
  const waMessageId = sent?.key?.id ?? undefined;

  if (kayit) {
    await prisma.whatsAppMessage.update({
      where: { id: kayit.id },
      data: { gonderimDurumu: "GONDERILDI", waMessageId },
    });
  } else {
    await prisma.whatsAppMessage.create({
      data: {
        telefon: temiz,
        yon: "GIDEN",
        icerik: text,
        complaintId,
        sentByUserId,
        outboundKey,
        gonderimDurumu: "GONDERILDI",
        waMessageId,
      },
    });
  }
  return { skipped: false };
}

/** Yalnız socket kurar ve event handler'ları bağlar */
async function baglan() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  // fetchLatestBaileysVersion eski surum dondurebiliyor; WA kaydi 405 ile
  // reddettigi icin once canli WA Web surumunu deneriz (bkz. Baileys #2705).
  const { version } = await fetchLatestWaWebVersion({}).catch(() =>
    fetchLatestBaileysVersion(),
  );
  console.log("WA Web surumu:", version.join("."));

  const yeni = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS("Chrome"),
    printQRInTerminal: false,
  });
  sock = yeni;

  yeni.ev.on("creds.update", saveCreds);

  yeni.ev.on("connection.update", async (update) => {
    const { connection: conn, lastDisconnect, qr } = update;
    if (qr) {
      console.log("WhatsApp QR — telefonunuzla tarayın:");
      qrcode.generate(qr, { small: true });
      await writeStatus({ connected: false, qrPending: true });
    }
    if (conn === "open") {
      console.log("WhatsApp bağlantısı açık");
      reconnectGecikme = RECONNECT_MIN_MS;
      await writeStatus({ connected: true, qrPending: false });
    }
    if (conn === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const yenidenBaglan = code !== DisconnectReason.loggedOut;
      await writeStatus({ connected: false, qrPending: false });
      console.log(
        "Bağlantı kapandı",
        code,
        yenidenBaglan ? "— yeniden bağlanılıyor" : "— oturum kapatıldı",
      );
      kapat(yeni);
      if (yenidenBaglan) zamanla();
    }
  });

  yeni.ev.on("messages.upsert", async ({ messages, type }) => {
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

      if (detected && !detected.medyaTipi) {
        // Video/belge/çıkartma: sessizce yutma, vatandaşa açıkça bildir
        job.medyaTipi = detected.tur;
        job.mimeType = detected.mimeType;
        job.mediaError = "unsupported";
      } else if (detected && waMessageId) {
        try {
          const saved = await downloadAndSaveMedia(m, waMessageId, detected);
          job.medyaUrl = saved.medyaUrl;
          job.medyaTipi = saved.medyaTipi;
          job.mimeType = saved.mimeType;
        } catch (err) {
          const code = (err as { code?: MediaErrorCode }).code;
          job.medyaTipi = detected.tur;
          job.mimeType = detected.mimeType;
          job.mediaError = code === "too_large" ? "too_large" : "download_failed";
          console.error("Medya indirme hatası", waMessageId, err);
        }
      } else if (detected && !waMessageId) {
        job.medyaTipi = detected.tur;
        job.mimeType = detected.mimeType;
        job.mediaError = "download_failed";
      }

      await queue.add("inbound", job, {
        jobId: waMessageId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }
  });
}

/** Eski socket'in dinleyicileri bırakılmazsa her reconnect'te birikirler */
function kapat(hedef: WASocket) {
  try {
    hedef.ev.removeAllListeners("creds.update");
    hedef.ev.removeAllListeners("connection.update");
    hedef.ev.removeAllListeners("messages.upsert");
    hedef.end(undefined);
  } catch (err) {
    console.error("Socket kapatma hatası", err);
  }
  if (sock === hedef) sock = null;
}

/** Tek zamanlayıcı: üst üste binen reconnect zincirleri oluşmaz */
function zamanla() {
  if (reconnectTimer) return;
  const gecikme = reconnectGecikme;
  reconnectGecikme = Math.min(reconnectGecikme * 2, RECONNECT_MAX_MS);
  console.log(`Yeniden bağlanma ${Math.round(gecikme / 1000)} sn sonra`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    baglan().catch((err) => {
      console.error("Yeniden bağlanma hatası", err);
      zamanla();
    });
  }, gecikme);
}

bootstrap()
  .then(baglan)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
