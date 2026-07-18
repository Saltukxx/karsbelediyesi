import { promises as fs } from "fs";
import path from "path";

export type BotStatus = {
  connected: boolean;
  lastSeen?: string;
  note: string;
  source: "http" | "file" | "none";
};

async function readFileStatus(): Promise<BotStatus | null> {
  const candidates = [
    process.env.WHATSAPP_BOT_STATUS_PATH,
    path.join(process.cwd(), "../../apps/whatsapp-bot/data/status.json"),
    path.join(process.cwd(), "../whatsapp-bot/data/status.json"),
  ].filter(Boolean) as string[];

  for (const statusPath of candidates) {
    try {
      const raw = await fs.readFile(statusPath, "utf8");
      const data = JSON.parse(raw) as {
        connected?: boolean;
        lastSeen?: string;
        qrPending?: boolean;
      };
      return {
        connected: Boolean(data.connected),
        lastSeen: data.lastSeen,
        note: data.qrPending
          ? "QR eşleştirme bekleniyor — bot terminalinde QR kodunu tarayın."
          : data.connected
            ? "Baileys oturumu aktif."
            : "Bot bağlı değil.",
        source: "file",
      };
    } catch {
      /* next */
    }
  }
  return null;
}

export async function getBotStatus(): Promise<BotStatus> {
  const healthUrl = process.env.WHATSAPP_BOT_HEALTH_URL;
  if (healthUrl) {
    try {
      const res = await fetch(healthUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          connected?: boolean;
          lastSeen?: string;
          qrPending?: boolean;
        };
        return {
          connected: Boolean(data.connected),
          lastSeen: data.lastSeen,
          note: data.qrPending
            ? "QR eşleştirme bekleniyor."
            : data.connected
              ? "Bot health endpoint aktif."
              : "Bot bağlı değil.",
          source: "http",
        };
      }
    } catch {
      /* file fallback */
    }
  }

  const fileStatus = await readFileStatus();
  if (fileStatus) return fileStatus;

  return {
    connected: false,
    note: "WhatsApp bot durumu okunamadı. `npm run dev:bot` ile başlatın veya WHATSAPP_BOT_HEALTH_URL tanımlayın.",
    source: "none",
  };
}
