import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { isUniqueViolation } from "@kars/db";
import type { Rol } from "@kars/shared";
import type { AppSession } from "@/lib/authz";

/**
 * Servisler aynı girdiyi iki kaynaktan alır: web Server Action'larının
 * `FormData`'sı (her şey string, boş alanlar "") ve `/api/v1` JSON gövdesi
 * (gerçek number/boolean/Date). Aşağıdaki yardımcılar iki biçimi de kabul eder.
 *
 * `z.coerce.*` girdi tipini genişletmediği için union + transform + pipe deseni
 * kullanılır; kısıtlar (min/int/nonnegative) pipe hedefine verilir.
 */

/** Boş string'i "gönderilmemiş" sayar; opsiyonel/varsayılanlı alanlar için. */
export function bosIse<T extends z.ZodTypeAny>(sema: T) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    sema,
  );
}

/** Ondalık ayırıcı olarak virgül de kabul edilir (web formlarının davranışı). */
export function sayiAlani(hedef: z.ZodNumber = z.number()) {
  return z
    .union([z.number(), z.string().trim().min(1)])
    .transform((v) => (typeof v === "number" ? v : Number(v.replace(",", "."))))
    .pipe(hedef);
}

export function opsiyonelSayi(hedef: z.ZodNumber = z.number()) {
  return bosIse(sayiAlani(hedef).optional());
}

/**
 * `new Date(...)` çok toleranslıdır ("15 Mart" bile geçerli bir tarih üretir),
 * bu yüzden metin girdide ISO ön eki (`YYYY-MM-DD`) zorunlu tutulur. Web'in
 * `date` / `datetime-local` alanları ve JSON istemcileri bu biçimi üretir.
 */
const ISO_TARIH = /^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/;

/** `2026-02-31` gibi biçimi doğru ama takvimde olmayan günler bir sonraki aya taşar. */
function takvimGunuGecerli(s: string): boolean {
  const eslesme = ISO_TARIH.exec(s);
  if (!eslesme) return false;
  const [, yil, ay, gunAlani] = eslesme;
  const ayNo = Number(ay);
  if (ayNo < 1 || ayNo > 12) return false;
  const aydakiGun = new Date(Date.UTC(Number(yil), ayNo, 0)).getUTCDate();
  const gunNo = Number(gunAlani);
  return gunNo >= 1 && gunNo <= aydakiGun;
}

export function tarihAlani() {
  return z
    .union([
      z.date(),
      z
        .string()
        .trim()
        .regex(ISO_TARIH, "Tarih YYYY-MM-DD biçiminde olmalı")
        .refine(takvimGunuGecerli, "Takvimde olmayan tarih"),
      z.number(),
    ])
    .pipe(z.coerce.date());
}

export function opsiyonelTarih() {
  return bosIse(tarihAlani().optional());
}

/** Boş string / null → undefined; kırpılmış metin döner */
export const opsiyonelMetin = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? undefined : s;
  });

export const zorunluMetin = (mesaj: string) => z.string().trim().min(1, mesaj);

/** Mesai hesaplarının beklediği "HH:mm" biçimi */
export function saatAlani() {
  return z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat HH:mm biçiminde olmalı");
}

/** FormData checkbox ("on"), "true"/"1" ve JSON boolean'ı aynı okur. */
export const mantiksalAlan = z
  .union([z.boolean(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v !== "string") return false;
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "on" || s === "evet";
  });

/** Varsayılanı olan enum alanı; boş string varsayılana düşer. */
export function enumAlani<T extends Record<string, string>>(
  values: T,
  varsayilan: T[keyof T],
) {
  return bosIse(z.nativeEnum(values).default(varsayilan));
}

/**
 * Kısmi güncellemelerde "gönderilip boşaltılan" alan ile "hiç gönderilmeyen"
 * alanı ayırmak için; ilki null'a çekilir, ikincisi dokunulmaz.
 */
export function alanGonderildi(input: unknown, alan: string): boolean {
  return typeof input === "object" && input !== null && alan in input;
}

/**
 * Server Action'lar servisleri bu dönüşümle çağırır: tüm alanlar string
 * olarak geçer, doğrulama ve tip dönüşümü tek yerde (şemada) yapılır.
 */
export function formVerisi(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Servis katmanı: iş mantığı hem Server Action'lardan hem `/api/v1` JSON
 * route'larından çağrılır. Servisler HTTP'den bağımsızdır; hata durumunda
 * ServiceError fırlatır, çağıran taraf bunu kendi formatına çevirir.
 */
export type ServiceActor = AppSession;

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function rolGerekli(actor: ServiceActor, roles: readonly Rol[]): void {
  if (!roles.includes(actor.user.role)) {
    throw new ServiceError("Yetkisiz", 403);
  }
}

export function bulunamadi(varlik: string): never {
  throw new ServiceError(`${varlik} bulunamadı`, 404);
}

/** ServiceError / ZodError / benzersizlik ihlali → JSON yanıtı; gerisi 500. */
export function serviceErrorResponse(e: unknown): NextResponse {
  if (e instanceof ServiceError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Geçersiz veri", detay: e.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (isUniqueViolation(e)) {
    return NextResponse.json({ error: "Bu kayıt zaten var" }, { status: 409 });
  }
  console.error("Servis hatası:", e);
  return NextResponse.json({ error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
}
