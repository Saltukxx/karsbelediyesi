import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  downloadMediaMessage,
  type WAMessage,
} from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MEDIA_DIR = path.join(__dirname, "../data/media");
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export type MedyaTipi = "image" | "audio";

export type MediaSaveResult = {
  medyaTipi: MedyaTipi;
  medyaUrl: string;
  mimeType: string;
  size: number;
};

export type MediaErrorCode = "download_failed" | "too_large" | "unsupported";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/wav": "wav",
};

export function extForMime(mimeType: string): string {
  const key = mimeType.toLowerCase().trim();
  if (MIME_EXT[key]) return MIME_EXT[key];
  const base = key.split(";")[0]?.trim() ?? key;
  if (MIME_EXT[base]) return MIME_EXT[base];
  if (base.startsWith("image/")) return base.slice("image/".length) || "bin";
  if (base.startsWith("audio/")) return base.slice("audio/".length) || "bin";
  return "bin";
}

export function detectInboundMedia(message: WAMessage["message"]): {
  medyaTipi: MedyaTipi;
  mimeType: string;
} | null {
  if (message?.imageMessage) {
    return {
      medyaTipi: "image",
      mimeType: message.imageMessage.mimetype || "image/jpeg",
    };
  }
  if (message?.audioMessage) {
    return {
      medyaTipi: "audio",
      mimeType: message.audioMessage.mimetype || "audio/ogg",
    };
  }
  return null;
}

export function placeholderIcerik(medyaTipi: MedyaTipi): string {
  return medyaTipi === "image" ? "(fotoğraf)" : "(sesli mesaj)";
}

export function isPlaceholderIcerik(text: string): boolean {
  const t = text.trim();
  return t === "(fotoğraf)" || t === "(sesli mesaj)" || t === "(medya)";
}

export async function downloadAndSaveMedia(
  message: WAMessage,
  waMessageId: string,
  detected: { medyaTipi: MedyaTipi; mimeType: string },
): Promise<MediaSaveResult> {
  const buffer = await downloadMediaMessage(message, "buffer", {});
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Medya buffer alınamadı");
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    const err = new Error("too_large") as Error & { code: MediaErrorCode };
    err.code = "too_large";
    throw err;
  }

  await mkdir(MEDIA_DIR, { recursive: true });
  const ext = extForMime(detected.mimeType);
  const fileName = `${waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
  const medyaUrl = path.join(MEDIA_DIR, fileName);
  await writeFile(medyaUrl, buffer);

  return {
    medyaTipi: detected.medyaTipi,
    medyaUrl,
    mimeType: detected.mimeType.split(";")[0]?.trim() || detected.mimeType,
    size: buffer.length,
  };
}
