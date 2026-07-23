import { prisma } from "@kars/db";

/** Bu süreden eski konumlar "bayat" sayılır ve dispatch'te kullanılmaz */
export const KONUM_TAZELIK_MS = 15 * 60 * 1000;

export function konumTazeMi(zaman: Date | null | undefined, now = Date.now()): boolean {
  return !!zaman && now - zaman.getTime() <= KONUM_TAZELIK_MS;
}

/** Kuş uçuşu mesafe (km) — haversine */
export function kusUcusuKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Şoförün o an sorumlu olduğu aracı bulur:
 * önce devam eden görevinin aracı, yoksa zimmetli aracı.
 */
export async function soforunAraci(userId: string): Promise<string | null> {
  const aktifGorev = await prisma.vehicleTask.findFirst({
    where: { driverId: userId, durum: "DEVAM_EDIYOR" },
    orderBy: { cikisTarihi: "desc" },
    select: { vehicleId: true },
  });
  if (aktifGorev) return aktifGorev.vehicleId;

  const zimmetli = await prisma.vehicle.findFirst({
    where: { atananSoforId: userId, envanterDurumu: { not: "HURDAYA_AYRILDI" } },
    select: { id: true },
  });
  return zimmetli?.id ?? null;
}

/**
 * Konum ping'ini kaydeder ve aracın denormalize son konumunu günceller.
 * Telefon (v1) ve ileride araç takip cihazı webhook'u aynı yolu kullanır.
 */
export async function konumPingKaydet(params: {
  vehicleId: string;
  driverId?: string | null;
  lat: number;
  lng: number;
  hiz?: number | null;
  kaynak?: "TELEFON" | "TAKIP_CIHAZI";
}): Promise<void> {
  const zaman = new Date();
  await prisma.$transaction([
    prisma.vehicleLocation.create({
      data: {
        vehicleId: params.vehicleId,
        driverId: params.driverId ?? null,
        lat: params.lat,
        lng: params.lng,
        hiz: params.hiz ?? null,
        kaynak: params.kaynak ?? "TELEFON",
        zaman,
      },
    }),
    prisma.vehicle.update({
      where: { id: params.vehicleId },
      data: {
        sonKonumLat: params.lat,
        sonKonumLng: params.lng,
        sonKonumZamani: zaman,
      },
    }),
  ]);
}
