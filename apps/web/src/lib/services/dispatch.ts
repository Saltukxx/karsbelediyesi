import { z } from "zod";
import { isRecordNotFound } from "@kars/db";
import type { DispatchTip } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import {
  adaylariSkorla,
  aracOner,
  dispatchAta,
  dispatchReddet,
  enYakinAracOner,
  type DispatchAday,
  type DispatchOneri,
} from "@/lib/dispatch";
import {
  bulunamadi,
  rolGerekli,
  ServiceError,
  zorunluMetin,
  type ServiceActor,
} from "@/lib/services/base";

/**
 * Akıllı sevkiyat servisi. Skorlama motoru `lib/dispatch.ts` içinde; buradaki
 * katman yetki, doğrulama, denetim kaydı ve hata çevirisini üstlenir.
 */

const tipAlani = z.enum(["KIS", "COP", "TEMIZLIK"]);

export const dispatchRotaInputSchema = z.object({
  tip: tipAlani,
  routeId: zorunluMetin("Rota gerekli"),
});

export const dispatchAracInputSchema = dispatchRotaInputSchema.extend({
  vehicleId: zorunluMetin("Araç gerekli"),
});

export const dispatchOneriInputSchema = z.object({
  jobId: zorunluMetin("Öneri gerekli"),
});

/** Client'a geometri gönderilmez; rota polyline'ı yalnız sunucuda kullanılır. */
export type DispatchAdayDto = Omit<DispatchAday, "rota">;

function adayDto(a: DispatchAday): DispatchAdayDto {
  return {
    vehicleId: a.vehicleId,
    plaka: a.plaka,
    tip: a.tip,
    sureDk: a.sureDk,
    mesafeKm: a.mesafeKm,
    tahmini: a.tahmini,
    skor: a.skor,
    kirilim: a.kirilim,
    etiketler: a.etiketler,
    bayat: a.bayat,
  };
}

/**
 * Dispatch motoru yarış durumlarını (öneri sonuçlanmış, araç artık müsait
 * değil) düz `Error` ile bildirir; bunlar istemci için 409, kayıp kayıt 404.
 */
async function dispatchIslemi<T>(islem: () => Promise<T>): Promise<T> {
  try {
    return await islem();
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    if (isRecordNotFound(e)) bulunamadi("Öneri");
    if (e instanceof Error) throw new ServiceError(e.message, 409);
    throw e;
  }
}

/** Rota için skorlanmış araç adayları (en fazla 5) */
export async function dispatchAdaylari(
  actor: ServiceActor,
  input: unknown,
): Promise<{ tip: DispatchTip; routeId: string; routeAd: string; adaylar: DispatchAdayDto[] }> {
  rolGerekli(actor, ACTION_ROLES.dispatch);
  const { tip, routeId } = dispatchRotaInputSchema.parse(input);

  const { routeAd, adaylar } = await adaylariSkorla(tip, routeId);
  // Motor, rota yoksa da güzergahı çizilmemişse de boş ad döner
  if (!routeAd) {
    throw new ServiceError("Rota bulunamadı veya güzergahı çizilmemiş", 404);
  }

  return { tip, routeId, routeAd, adaylar: adaylar.map(adayDto) };
}

/** Rota için en uygun aracı bulup bekleyen öneri (DispatchJob) üretir */
export async function dispatchOneriUret(
  actor: ServiceActor,
  input: unknown,
): Promise<DispatchOneri | null> {
  rolGerekli(actor, ACTION_ROLES.dispatch);
  const { tip, routeId } = dispatchRotaInputSchema.parse(input);

  const oneri = await dispatchIslemi(() => enYakinAracOner(tip, routeId));
  if (oneri) {
    await auditKaydet(actor, "DISPATCH_ONER", {
      varlik: "DispatchJob",
      varlikId: oneri.jobId,
      detay: { tip, routeAd: oneri.routeAd, plaka: oneri.plaka },
    });
  }
  return oneri;
}

/** Belirli bir aracı seçip tek adımda görev açar (panelin "Ata" butonu) */
export async function dispatchAracAta(
  actor: ServiceActor,
  input: unknown,
): Promise<{ gorevNo: string; taskId: string; jobId: string }> {
  rolGerekli(actor, ACTION_ROLES.dispatch);
  const { tip, routeId, vehicleId } = dispatchAracInputSchema.parse(input);

  const oneri = await dispatchIslemi(() => aracOner(tip, routeId, vehicleId));
  if (!oneri) {
    throw new ServiceError("Seçilen araç artık uygun değil — listeyi yenileyin", 409);
  }

  const { gorevNo, taskId } = await dispatchIslemi(() =>
    dispatchAta(oneri.jobId, actor.user),
  );
  await auditKaydet(actor, "DISPATCH_ATA", {
    varlik: "VehicleTask",
    varlikId: taskId,
    detay: { gorevNo, jobId: oneri.jobId, plaka: oneri.plaka, skor: oneri.gerekce?.skor },
  });
  return { gorevNo, taskId, jobId: oneri.jobId };
}

/** Bekleyen öneriyi kabul et: görev oluştur, aracı yola çıkar */
export async function dispatchOneriAta(
  actor: ServiceActor,
  input: unknown,
): Promise<{ gorevNo: string; taskId: string; jobId: string }> {
  rolGerekli(actor, ACTION_ROLES.dispatch);
  const { jobId } = dispatchOneriInputSchema.parse(input);

  const { gorevNo, taskId } = await dispatchIslemi(() => dispatchAta(jobId, actor.user));
  await auditKaydet(actor, "DISPATCH_ATA", {
    varlik: "VehicleTask",
    varlikId: taskId,
    detay: { gorevNo, jobId },
  });
  return { gorevNo, taskId, jobId };
}

/** Bekleyen öneriyi reddet */
export async function dispatchOneriReddet(
  actor: ServiceActor,
  input: unknown,
): Promise<{ jobId: string }> {
  rolGerekli(actor, ACTION_ROLES.dispatch);
  const { jobId } = dispatchOneriInputSchema.parse(input);

  await dispatchIslemi(() => dispatchReddet(jobId));
  await auditKaydet(actor, "DISPATCH_REDDET", {
    varlik: "DispatchJob",
    varlikId: jobId,
  });
  return { jobId };
}
