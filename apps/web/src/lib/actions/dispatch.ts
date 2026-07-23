"use server";

import { revalidatePath } from "next/cache";
import type { DispatchTip } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import {
  dispatchAta,
  dispatchReddet,
  enYakinAracOner,
  otomatikAtamaAyarla,
  type DispatchOneri,
} from "@/lib/dispatch";

function sayfa(tip: DispatchTip): string {
  return tip === "KIS" ? "/kis" : "/cop";
}

/** Rota için en yakın aracı bul ve öneri (DispatchJob) üret */
export async function dispatchOnerAction(
  tip: DispatchTip,
  routeId: string,
): Promise<DispatchOneri | null> {
  const session = await requireRoles(ACTION_ROLES.dispatch);
  const oneri = await enYakinAracOner(tip, routeId);
  if (oneri) {
    await auditKaydet(session, "DISPATCH_ONER", {
      varlik: "DispatchJob",
      varlikId: oneri.jobId,
      detay: { tip, routeAd: oneri.routeAd, plaka: oneri.plaka },
    });
  }
  revalidatePath(sayfa(tip));
  return oneri;
}

/** Öneriyi kabul et: görev oluştur, aracı yola çıkar */
export async function dispatchAtaAction(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.dispatch);
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) throw new Error("Öneri bulunamadı");
  const tip = (String(formData.get("tip") ?? "KIS") === "COP" ? "COP" : "KIS") as DispatchTip;

  const { gorevNo, taskId } = await dispatchAta(jobId, session.user);
  await auditKaydet(session, "DISPATCH_ATA", {
    varlik: "VehicleTask",
    varlikId: taskId,
    detay: { gorevNo, jobId },
  });
  revalidatePath(sayfa(tip));
  revalidatePath("/gorevler");
  revalidatePath("/araclar");
}

/** Öneriyi reddet */
export async function dispatchReddetAction(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.dispatch);
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) throw new Error("Öneri bulunamadı");
  const tip = (String(formData.get("tip") ?? "KIS") === "COP" ? "COP" : "KIS") as DispatchTip;

  await dispatchReddet(jobId);
  await auditKaydet(session, "DISPATCH_REDDET", {
    varlik: "DispatchJob",
    varlikId: jobId,
  });
  revalidatePath(sayfa(tip));
}

/** Tanımlar: tam otomatik atama anahtarı */
export async function otomatikAtamaKaydet(formData: FormData): Promise<void> {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const acik = formData.get("otomatikAtama") === "on";
  await otomatikAtamaAyarla(acik);
  await auditKaydet(session, "DISPATCH_OTOMATIK_AYAR", {
    detay: { acik },
  });
  revalidatePath("/tanimlar");
}
