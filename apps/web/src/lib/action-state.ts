import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

/**
 * Server action'ların `useActionState` ile döndürdüğü ortak sonuç tipi.
 * `null` = henüz gönderilmedi.
 */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Alan adı → hata mesajı (Zod path'inden üretilir) */
  fieldErrors?: Record<string, string>;
  /** Hata sonrası formu yeniden doldurmak için gönderilen değerler */
  values?: Record<string, string | string[]>;
} | null;

const GENEL_HATA = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";

/** Gizli/altyapı alanları geri yansıtılmaz. */
function tasinabilirAlan(key: string): boolean {
  return !key.startsWith("$ACTION");
}

/** FormData'yı hata durumunda forma geri vermek üzere düzleştirir. */
export function formDegerleri(
  formData: FormData,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    // Dosya girdileri taşınamaz; yalnız metin alanları geri yansıtılır
    if (typeof value !== "string" || !tasinabilirAlan(key)) continue;
    const mevcut = out[key];
    if (mevcut === undefined) out[key] = value;
    else if (Array.isArray(mevcut)) mevcut.push(value);
    else out[key] = [mevcut, value];
  }
  return out;
}

/**
 * Action gövdesindeki hatayı kullanıcıya gösterilebilir duruma çevirir.
 * `redirect()` / `notFound()` gibi Next.js kontrol akışı sinyalleri
 * `unstable_rethrow` ile aynen yukarı taşınır — yoksa yönlendirme "hata"
 * sanılıp yutulur.
 */
export function actionHatasi(e: unknown, formData?: FormData): ActionState {
  unstable_rethrow(e);

  const values = formData ? formDegerleri(formData) : undefined;

  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Lütfen işaretli alanları düzeltin.",
      fieldErrors,
      values,
    };
  }

  return {
    ok: false,
    message: e instanceof Error && e.message ? e.message : GENEL_HATA,
    values,
  };
}

export function actionBasarili(message: string): ActionState {
  return { ok: true, message };
}
