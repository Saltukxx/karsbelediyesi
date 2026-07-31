import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage, type WAMessage } from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MEDIA_DIR = path.join(__dirname, "../data/media");
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

export type MedyaTipi = "image" | "audio";

/** Desteklenmeyen ama tanınan ek türler — vatandaşa açık yanıt verilir */
export type DesteksizTur = "video" | "document" | "sticker";

export type DetectedMedia = {
  /** Desteklenen tür değilse null */
  medyaTipi: MedyaTipi | null;
  /** Log/kayıt için ham tür adı */
  tur: MedyaTipi | DesteksizTur;
  mimeType: string;
  /** WhatsApp'ın bildirdiği boyut — indirmeden önce sınır kontrolü için */
  fileLength: number | null;
};

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

function uzunluk(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  // protobuf Long { low, high, unsigned }
  if (value && typeof value === "object" && "low" in value) {
    const n = Number((value as { low: number }).low);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function detectInboundMedia(
  message: WAMessage["message"],
): DetectedMedia | null {
  if (message?.imageMessage) {
    return {
      medyaTipi: "image",
      tur: "image",
      mimeType: message.imageMessage.mimetype || "image/jpeg",
      fileLength: uzunluk(message.imageMessage.fileLength),
    };
  }
  if (message?.audioMessage) {
    return {
      medyaTipi: "audio",
      tur: "audio",
      mimeType: message.audioMessage.mimetype || "audio/ogg",
      fileLength: uzunluk(message.audioMessage.fileLength),
    };
  }
  if (message?.videoMessage) {
    return {
      medyaTipi: null,
      tur: "video",
      mimeType: message.videoMessage.mimetype || "video/mp4",
      fileLength: uzunluk(message.videoMessage.fileLength),
    };
  }
  if (message?.documentMessage) {
    return {
      medyaTipi: null,
      tur: "document",
      mimeType: message.documentMessage.mimetype || "application/octet-stream",
      fileLength: uzunluk(message.documentMessage.fileLength),
    };
  }
  if (message?.stickerMessage) {
    return {
      medyaTipi: null,
      tur: "sticker",
      mimeType: message.stickerMessage.mimetype || "image/webp",
      fileLength: uzunluk(message.stickerMessage.fileLength),
    };
  }
  return null;
}

export function placeholderIcerik(medyaTipi: MedyaTipi | null): string {
  if (medyaTipi === "image") return "(fotoğraf)";
  if (medyaTipi === "audio") return "(sesli mesaj)";
  return "(dosya)";
}

export function isPlaceholderIcerik(text: string): boolean {
  const t = text.trim();
  return (
    t === "(fotoğraf)" || t === "(sesli mesaj)" || t === "(medya)" || t === "(dosya)"
  );
}

function medyaHatasi(code: MediaErrorCode): Error & { code: MediaErrorCode } {
  const err = new Error(code) as Error & { code: MediaErrorCode };
  err.code = code;
  return err;
}

/**
 * Medyayı diske akıtarak indirir. Tamamını belleğe almamak için stream
 * kullanılır ve sınır aşılır aşılmaz indirme kesilir.
 */
export async function downloadAndSaveMedia(
  message: WAMessage,
  waMessageId: string,
  detected: DetectedMedia,
): Promise<MediaSaveResult> {
  if (!detected.medyaTipi) throw medyaHatasi("unsupported");

  // WhatsApp boyutu bildiriyorsa indirmeye hiç başlama
  if (detected.fileLength != null && detected.fileLength > MAX_MEDIA_BYTES) {
    throw medyaHatasi("too_large");
  }

  await mkdir(MEDIA_DIR, { recursive: true });
  const ext = extForMime(detected.mimeType);
  const fileName = `${waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
  const medyaUrl = path.join(MEDIA_DIR, fileName);

  // downloadMediaMessage medya içeriğini/tipini kendisi seçer (şifre çözme ve
  // yeniden indirme mantığı dahil); "stream" ile bellekte biriktirmeden yazarız.
  const stream = await downloadMediaMessage(message, "stream", {});
  const out = createWriteStream(medyaUrl);
  let size = 0;
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > MAX_MEDIA_BYTES) throw medyaHatasi("too_large");
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      }
    }
    await new Promise<void>((resolve, reject) => {
      out.once("error", reject);
      out.end(() => resolve());
    });
  } catch (err) {
    stream.destroy();
    out.destroy();
    await unlink(medyaUrl).catch(() => {});
    throw err;
  }

  if (size === 0) {
    await unlink(medyaUrl).catch(() => {});
    throw medyaHatasi("download_failed");
  }

  return {
    medyaTipi: detected.medyaTipi,
    medyaUrl,
    mimeType: detected.mimeType.split(";")[0]?.trim() || detected.mimeType,
    size,
  };
}
