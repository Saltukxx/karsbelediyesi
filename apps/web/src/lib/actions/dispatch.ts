"use server";

import { revalidatePath } from "next/cache";
import type { DispatchTip } from "@kars/db";
import { ACTION_ROLES, requireRoles, requireSession } from "@/lib/authz";
import { type DispatchOneri } from "@/lib/dispatch";
import { formVerisi } from "@/lib/services/base";
import { otomatikAtamaKaydet as otomatikAtamaServis } from "@/lib/services/definitions";
import {
  dispatchAdaylari,
  dispatchAracAta,
  dispatchOneriAta,
  dispatchOneriReddet,
  dispatchOneriUret,
  type DispatchAdayDto,
} from "@/lib/services/dispatch";

function sayfa(tip: DispatchTip): string {
  switch (tip) {
    case "KIS":
      return "/kis";
    case "COP":
      return "/cop";
    case "TEMIZLIK":
      return "/temizlik";
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }
}

function parseTip(v: FormDataEntryValue | null): DispatchTip {
  const s = String(v ?? "KIS");
  return s === "COP" || s === "TEMIZLIK" ? s : "KIS";
}

/** UI için skorlanmış aday listesi (top 5) — rota seçilince çağrılır */
export async function dispatchAdaylariGetir(
  tip: DispatchTip,
  routeId: string,
): Promise<{ routeAd: string; adaylar: DispatchAdayDto[] }> {
  const session = await requireSession();
  const { routeAd, adaylar } = await dispatchAdaylari(session, { tip, routeId });
  return { routeAd, adaylar };
}

/** Seçilen adayı öneri yap + hemen ata (tek tık Ata) */
export async function dispatchAracAtaAction(
  tip: DispatchTip,
  routeId: string,
  vehicleId: string,
): Promise<{ gorevNo: string }> {
  const session = await requireSession();
  const { gorevNo } = await dispatchAracAta(session, { tip, routeId, vehicleId });
  revalidatePath(sayfa(tip));
  revalidatePath("/gorevler");
  revalidatePath("/araclar");
  return { gorevNo };
}

/** Rota için en yakın aracı bul ve öneri (DispatchJob) üret */
export async function dispatchOnerAction(
  tip: DispatchTip,
  routeId: string,
): Promise<DispatchOneri | null> {
  const session = await requireSession();
  try {
    return await dispatchOneriUret(session, { tip, routeId });
  } finally {
    revalidatePath(sayfa(tip));
  }
}

/** Öneriyi kabul et: görev oluştur, aracı yola çıkar */
export async function dispatchAtaAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const jobId = String(formData.get("jobId") ?? "");
  const tip = parseTip(formData.get("tip"));

  try {
    await dispatchOneriAta(session, { jobId });
  } finally {
    revalidatePath(sayfa(tip));
    revalidatePath("/gorevler");
    revalidatePath("/araclar");
  }
}

/** Öneriyi reddet */
export async function dispatchReddetAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const jobId = String(formData.get("jobId") ?? "");
  const tip = parseTip(formData.get("tip"));

  try {
    await dispatchOneriReddet(session, { jobId });
  } finally {
    revalidatePath(sayfa(tip));
  }
}

/** Tanımlar: tam otomatik atama anahtarı */
export async function otomatikAtamaKaydet(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.definitions);
  await otomatikAtamaServis(session, formVerisi(formData));
  revalidatePath("/tanimlar");
}
