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

export function complaintPhotoDir(): string {
  const base = process.env.UPLOAD_DIR || path.join(process.cwd(), "data/uploads");
  return path.join(base, "complaints");
}

export function isAllowedComplaintPhotoMime(mime: string): boolean {
  return mime.toLowerCase() in EXT_BY_MIME;
}

/** Dosyayı diske yazar, kaydedilen dosya adını döner */
export async function saveComplaintPhoto(file: File): Promise<string> {
  const mime = file.type.toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error("Desteklenmeyen dosya türü");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Dosya çok büyük (max 8MB)");

  const dir = complaintPhotoDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, fileName), buffer);
  return fileName;
}

/** Path traversal'a kapalı güvenli dosya çözümleme */
export async function resolveComplaintPhotoPath(
  fileName: string,
): Promise<string | null> {
  const base = path.basename(fileName);
  if (!base || base.includes("..")) return null;
  const candidate = path.join(complaintPhotoDir(), base);
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

/** Path traversal'a kapalı dosya silme (orphan temizlik). */
export async function deleteComplaintPhotoFile(fileName: string): Promise<void> {
  const resolved = await resolveComplaintPhotoPath(fileName);
  if (!resolved) return;
  try {
    await fs.unlink(resolved);
  } catch {
    /* dosya zaten yok */
  }
}

/** FormData'dan fotoğraf dosyalarını kaydeder (max 8 adet). */
export async function saveComplaintPhotosFromForm(
  formData: FormData,
  field = "cozumFotolari",
): Promise<string[]> {
  const photoFiles = formData
    .getAll(field)
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 8);

  for (const f of photoFiles) {
    if (!isAllowedComplaintPhotoMime(f.type)) {
      throw new Error("Sadece JPEG/PNG/WebP fotoğraf yüklenebilir");
    }
  }

  const names: string[] = [];
  try {
    for (const f of photoFiles) {
      names.push(await saveComplaintPhoto(f));
    }
  } catch (e) {
    await Promise.all(names.map((n) => deleteComplaintPhotoFile(n)));
    throw e;
  }
  return names;
}

/** DB yazımı başarısız olursa diske yazılmış dosyaları temizle. */
export async function cleanupComplaintPhotoFiles(names: string[]): Promise<void> {
  await Promise.all(names.map((n) => deleteComplaintPhotoFile(n)));
}

/**
 * Mobil API için base64 / data-URL görselleri kaydeder (max 8).
 * Örnek: "data:image/jpeg;base64,...." veya ham base64 (+ mime).
 */
export async function saveComplaintPhotosFromBase64(
  inputs: Array<string | { data: string; mime?: string }>,
): Promise<string[]> {
  const slice = inputs.slice(0, 8);
  const names: string[] = [];
  try {
    for (const item of slice) {
      let mime = "image/jpeg";
      let b64: string;
      if (typeof item === "string") {
        const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(item);
        if (m) {
          mime = m[1]!.toLowerCase();
          b64 = m[2]!;
        } else {
          b64 = item;
        }
      } else {
        mime = (item.mime ?? "image/jpeg").toLowerCase();
        const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(item.data);
        if (m) {
          mime = m[1]!.toLowerCase();
          b64 = m[2]!;
        } else {
          b64 = item.data;
        }
      }
      if (!isAllowedComplaintPhotoMime(mime)) {
        throw new Error("Sadece JPEG/PNG/WebP fotoğraf yüklenebilir");
      }
      const ext = EXT_BY_MIME[mime];
      if (!ext) throw new Error("Desteklenmeyen dosya türü");
      const buffer = Buffer.from(b64, "base64");
      if (buffer.length > MAX_PHOTO_BYTES) {
        throw new Error("Dosya çok büyük (max 8MB)");
      }
      if (buffer.length === 0) continue;

      const dir = complaintPhotoDir();
      await fs.mkdir(dir, { recursive: true });
      const fileName = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(path.join(dir, fileName), buffer);
      names.push(fileName);
    }
  } catch (e) {
    await cleanupComplaintPhotoFiles(names);
    throw e;
  }
  return names;
}
