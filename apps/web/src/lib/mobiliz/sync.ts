import { prisma } from "@kars/db";
import { konumPingKaydet, kusUcusuKm } from "@/lib/location";
import {
  fetchMobilizActivityLast,
  mobilizConfigured,
  normalizePlaka,
} from "@/lib/mobiliz/client";
import type { MobilizSyncStatus } from "@/lib/mobiliz/types";

export type { MobilizSyncStatus };

/** Konum 50 m'den az değiştiyse yazma (Oltu eşiği) */
const MIN_MOVE_KM = 0.05;

let sonDurum: MobilizSyncStatus = {
  configured: false,
  lastSyncAt: null,
  lastSyncSuccess: false,
  lastSyncError: null,
  matched: 0,
  updated: 0,
  skipped: 0,
  unmatchedPlates: [],
};

let sonTarama = 0;
let syncKilit = false;

export function getMobilizSyncStatus(): MobilizSyncStatus {
  return {
    ...sonDurum,
    configured: mobilizConfigured(),
  };
}

/**
 * Mobiliz'ten son konumları çeker; plaka ile mevcut araçlara eşler;
 * konumPingKaydet(..., TAKIP_CIHAZI) yazar. Otomatik araç yaratılmaz.
 */
export async function mobilizSyncCalistir(opts?: {
  /** true ise throttle yok (cron/manuel) */
  force?: boolean;
}): Promise<MobilizSyncStatus> {
  const intervalMs = Number(process.env.MOBILIZ_SYNC_INTERVAL || 60_000);
  const simdi = Date.now();
  if (!opts?.force && simdi - sonTarama < intervalMs) {
    return getMobilizSyncStatus();
  }
  if (syncKilit) return getMobilizSyncStatus();
  syncKilit = true;
  sonTarama = simdi;

  try {
    return await mobilizSyncGovde();
  } finally {
    syncKilit = false;
  }
}

async function mobilizSyncGovde(): Promise<MobilizSyncStatus> {
  if (!mobilizConfigured()) {
    sonDurum = {
      ...sonDurum,
      configured: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncSuccess: false,
      lastSyncError: "yapılandırılmadı",
      matched: 0,
      updated: 0,
      skipped: 0,
      unmatchedPlates: [],
    };
    return getMobilizSyncStatus();
  }

  try {
    const live = await fetchMobilizActivityLast();
    const araclar = await prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      select: {
        id: true,
        plaka: true,
        sonKonumLat: true,
        sonKonumLng: true,
      },
    });

    const byPlaka = new Map(
      araclar.map((a) => [normalizePlaka(a.plaka), a] as const),
    );

    let matched = 0;
    let updated = 0;
    let skipped = 0;
    const unmatched: string[] = [];

    for (const mv of live) {
      const key = normalizePlaka(mv.plate);
      const arac = byPlaka.get(key);
      if (!arac) {
        unmatched.push(mv.plate);
        continue;
      }
      matched++;

      if (
        arac.sonKonumLat != null &&
        arac.sonKonumLng != null &&
        kusUcusuKm(arac.sonKonumLat, arac.sonKonumLng, mv.lat, mv.lng) <
          MIN_MOVE_KM
      ) {
        skipped++;
        continue;
      }

      await konumPingKaydet({
        vehicleId: arac.id,
        lat: mv.lat,
        lng: mv.lng,
        hiz: mv.hiz,
        kaynak: "TAKIP_CIHAZI",
      });
      updated++;
    }

    sonDurum = {
      configured: true,
      lastSyncAt: new Date().toISOString(),
      lastSyncSuccess: true,
      lastSyncError: null,
      matched,
      updated,
      skipped,
      unmatchedPlates: unmatched.slice(0, 20),
    };
  } catch (e) {
    sonDurum = {
      ...sonDurum,
      configured: true,
      lastSyncAt: new Date().toISOString(),
      lastSyncSuccess: false,
      lastSyncError: e instanceof Error ? e.message : "Bilinmeyen hata",
    };
  }

  return getMobilizSyncStatus();
}
