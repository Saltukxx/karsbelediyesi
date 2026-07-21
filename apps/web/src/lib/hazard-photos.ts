import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function hazardPhotoDir(): string {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), "data/uploads");
  return path.join(base, "hazards");
}

export function isAllowedPhotoMime(mime: string): boolean {
  return mime.toLowerCase() in EXT_BY_MIME;
}

/** Dosyayı diske yazar, kaydedilen dosya adını döner */
export async function saveHazardPhoto(file: File): Promise<string> {
  const mime = file.type.toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error("Desteklenmeyen dosya türü");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Dosya çok büyük (max 8MB)");

  const dir = hazardPhotoDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, fileName), buffer);
  return fileName;
}

/** Path traversal'a kapalı güvenli dosya çözümleme */
export async function resolveHazardPhotoPath(fileName: string): Promise<string | null> {
  const base = path.basename(fileName);
  if (!base || base.includes("..")) return null;
  const candidate = path.join(hazardPhotoDir(), base);
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function deleteHazardPhotoFile(fileName: string): Promise<void> {
  const resolved = await resolveHazardPhotoPath(fileName);
  if (!resolved) return;
  try {
    await fs.unlink(resolved);
  } catch {
    /* dosya zaten yok */
  }
}
