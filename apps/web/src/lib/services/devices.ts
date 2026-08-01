import { z } from "zod";
import { prisma } from "@kars/db";
import {
  opsiyonelMetin,
  ServiceError,
  zorunluMetin,
  type ServiceActor,
} from "@/lib/services/base";

/**
 * APNs cihaz kaydı. Token cihaza aittir, kullanıcıya değil: aynı telefonda
 * başka kullanıcı oturum açarsa kayıt ona devredilir, böylece önceki
 * kullanıcının bildirimleri yeni kullanıcıya düşmez.
 */

const HEX_TOKEN = /^[0-9a-fA-F]{32,200}$/;

export const cihazKayitSchema = z.object({
  token: zorunluMetin("Cihaz token'ı gerekli").regex(
    HEX_TOKEN,
    "Cihaz token'ı geçersiz",
  ),
  platform: z.enum(["APNS", "APNS_SANDBOX"]).default("APNS"),
  uygulama: opsiyonelMetin,
  cihaz: opsiyonelMetin,
});

export const cihazSilSchema = z.object({
  token: zorunluMetin("Cihaz token'ı gerekli"),
});

export interface CihazDto {
  id: string;
  platform: string;
  aktif: boolean;
  sonGoruldu: string;
}

export async function cihazKaydet(
  actor: ServiceActor,
  input: unknown,
): Promise<CihazDto> {
  const data = cihazKayitSchema.parse(input);

  const ortak = {
    userId: actor.user.id,
    platform: data.platform,
    uygulama: data.uygulama,
    cihaz: data.cihaz,
    aktif: true,
    sonGoruldu: new Date(),
  };
  const kayit = await prisma.deviceToken.upsert({
    where: { token: data.token },
    create: { token: data.token, ...ortak },
    update: ortak,
  });

  return {
    id: kayit.id,
    platform: kayit.platform,
    aktif: kayit.aktif,
    sonGoruldu: kayit.sonGoruldu.toISOString(),
  };
}

/**
 * Çıkışta cihaz pasifleştirilir (silinmez): aynı token yeniden kaydedilirse
 * geçmişi korunur ve Apple'ın geçersiz saydığı tokenlar ayırt edilebilir.
 */
export async function cihazKaldir(
  actor: ServiceActor,
  input: unknown,
): Promise<{ token: string; aktif: false }> {
  const { token } = cihazSilSchema.parse(input);

  const sonuc = await prisma.deviceToken.updateMany({
    where: { token, userId: actor.user.id },
    data: { aktif: false },
  });
  if (sonuc.count === 0) {
    throw new ServiceError("Cihaz kaydı bulunamadı", 404);
  }
  return { token, aktif: false };
}
