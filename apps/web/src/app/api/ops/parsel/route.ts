import { NextResponse } from "next/server";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { prisma } from "@kars/db";
import type { Prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";
import {
  KARS_IL_ID,
  TkgmError,
  ilceListe,
  mahalleListe,
  parselByAdaParsel,
  parselByKoordinat,
  type ParcelGeometry,
  type TkgmParcel,
} from "@/lib/tkgm";

export const dynamic = "force-dynamic";

/** İfraz/tevhid sonrası bayat geometriye karşı cache ömrü */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface ParcelDto {
  id: string;
  ilAd: string;
  ilceAd: string;
  mahalleAd: string;
  mahalleId: number;
  adaNo: string;
  parselNo: string;
  alan: number | null;
  nitelik: string | null;
  mevkii: string | null;
  pafta: string | null;
  geometri: ParcelGeometry;
  lat: number;
  lng: number;
  kaynak: "cache" | "tkgm";
  sorgulandi: string;
}

type ParcelRow = Prisma.ParcelGetPayload<Record<string, never>>;

function toDto(row: ParcelRow, kaynak: "cache" | "tkgm"): ParcelDto {
  return {
    id: row.id,
    ilAd: row.ilAd,
    ilceAd: row.ilceAd,
    mahalleAd: row.mahalleAd,
    mahalleId: row.mahalleId,
    adaNo: row.adaNo,
    parselNo: row.parselNo,
    alan: row.alan,
    nitelik: row.nitelik,
    mevkii: row.mevkii,
    pafta: row.pafta,
    geometri: row.geometri as unknown as ParcelGeometry,
    lat: row.lat,
    lng: row.lng,
    kaynak,
    sorgulandi: row.updatedAt.toISOString(),
  };
}

function isFresh(row: ParcelRow): boolean {
  return Date.now() - row.updatedAt.getTime() < CACHE_TTL_MS;
}

async function upsertParcel(
  parcel: TkgmParcel,
  userId: string,
): Promise<ParcelRow> {
  const data = {
    ilAd: parcel.ilAd,
    ilceAd: parcel.ilceAd,
    mahalleAd: parcel.mahalleAd,
    mahalleId: parcel.mahalleId,
    adaNo: parcel.adaNo,
    parselNo: parcel.parselNo,
    alan: parcel.alan,
    nitelik: parcel.nitelik,
    mevkii: parcel.mevkii,
    pafta: parcel.pafta,
    geometri: parcel.geometri as unknown as Prisma.InputJsonValue,
    lat: parcel.lat,
    lng: parcel.lng,
    minLat: parcel.minLat,
    maxLat: parcel.maxLat,
    minLng: parcel.minLng,
    maxLng: parcel.maxLng,
    sorgulayanId: userId,
  };
  try {
    return await prisma.parcel.upsert({
      where: {
        mahalleId_adaNo_parselNo: {
          mahalleId: parcel.mahalleId,
          adaNo: parcel.adaNo,
          parselNo: parcel.parselNo,
        },
      },
      create: data,
      update: data,
    });
  } catch (e) {
    // Eşzamanlı upsert yarışı — kaydı diğer istek yazdı, tekrar oku
    const existing = await prisma.parcel.findUnique({
      where: {
        mahalleId_adaNo_parselNo: {
          mahalleId: parcel.mahalleId,
          adaNo: parcel.adaNo,
          parselNo: parcel.parselNo,
        },
      },
    });
    if (existing) return existing;
    throw e;
  }
}

async function findCachedByPoint(
  lat: number,
  lng: number,
): Promise<ParcelRow | null> {
  const candidates = await prisma.parcel.findMany({
    where: {
      minLat: { lte: lat },
      maxLat: { gte: lat },
      minLng: { lte: lng },
      maxLng: { gte: lng },
    },
    take: 20,
  });
  const p = point([lng, lat]);
  for (const row of candidates) {
    const geom = row.geometri as unknown as ParcelGeometry;
    try {
      if (booleanPointInPolygon(p, { type: "Feature", properties: {}, geometry: geom })) {
        return row;
      }
    } catch {
      // Bozuk geometri — cache kaydını atla
    }
  }
  return null;
}

function errorResponse(e: unknown): NextResponse {
  if (e instanceof TkgmError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("Parsel sorgu hatası:", e);
  return NextResponse.json(
    { error: "Parsel sorgusu sırasında beklenmeyen bir hata oluştu" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  let userId: string;
  try {
    const session = await requireSession();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams;
  const refresh = q.get("refresh") === "1";

  try {
    // İlçe listesi (Kars ili)
    if (q.get("liste") === "ilce") {
      return NextResponse.json({ items: await ilceListe(KARS_IL_ID) });
    }

    // Mahalle listesi
    const ilceId = q.get("ilceId");
    if (ilceId !== null) {
      const id = Number(ilceId);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Geçersiz ilçe" }, { status: 400 });
      }
      return NextResponse.json({ items: await mahalleListe(id) });
    }

    // Ada/parsel sorgusu
    const mahalleId = q.get("mahalleId");
    if (mahalleId !== null) {
      const mid = Number(mahalleId);
      const ada = (q.get("ada") ?? "0").trim() || "0";
      const parsel = (q.get("parsel") ?? "").trim();
      if (!Number.isInteger(mid) || mid <= 0) {
        return NextResponse.json({ error: "Geçersiz mahalle" }, { status: 400 });
      }
      if (!/^\d+$/.test(parsel) || !/^\d+$/.test(ada)) {
        return NextResponse.json(
          { error: "Ada ve parsel numarası sayısal olmalı" },
          { status: 400 },
        );
      }

      if (!refresh) {
        const cached = await prisma.parcel.findUnique({
          where: {
            mahalleId_adaNo_parselNo: {
              mahalleId: mid,
              adaNo: ada,
              parselNo: parsel,
            },
          },
        });
        if (cached && isFresh(cached)) {
          return NextResponse.json(toDto(cached, "cache"));
        }
      }

      const parcel = await parselByAdaParsel(mid, ada, parsel);
      const row = await upsertParcel(parcel, userId);
      return NextResponse.json(toDto(row, "tkgm"));
    }

    // Koordinat sorgusu
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Geçersiz sorgu parametreleri" },
        { status: 400 },
      );
    }
    if (lat < 35 || lat > 43 || lng < 25 || lng > 45) {
      return NextResponse.json(
        { error: "Koordinat Türkiye sınırları dışında" },
        { status: 400 },
      );
    }

    if (!refresh) {
      const cached = await findCachedByPoint(lat, lng);
      if (cached && isFresh(cached)) {
        return NextResponse.json(toDto(cached, "cache"));
      }
    }

    const parcel = await parselByKoordinat(lat, lng);
    const row = await upsertParcel(parcel, userId);
    return NextResponse.json(toDto(row, "tkgm"));
  } catch (e) {
    return errorResponse(e);
  }
}
