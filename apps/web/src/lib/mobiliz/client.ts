/**
 * Mobiliz API istemcisi (Oltu mobilizService şablonundan sadeleştirilmiş).
 * Token yokken tüm çağrılar yapılandırılmamış döner.
 */

export type MobilizActivity = {
  muId: number;
  plate: string;
  latitude: number;
  longitude: number;
  speed: number;
  dataTime: string;
  gpsTime: string;
};

export type MobilizVehicleLive = {
  muId: number;
  plate: string;
  lat: number;
  lng: number;
  hiz: number;
  zaman: string;
};

type MobilizEnvelope<T> = {
  success?: boolean;
  result?: T;
  message?: string;
};

export type MobilizConfig = {
  token: string;
  baseUrl: string;
};

export function getMobilizConfig(): MobilizConfig | null {
  const token =
    process.env.MOBILIZ_TOKEN?.trim() || process.env.MOBILIZ_API_KEY?.trim();
  if (!token) return null;
  const baseUrl = (
    process.env.MOBILIZ_BASE_URL ||
    process.env.MOBILIZ_API_BASE_URL ||
    "https://api.mobiliz.com.tr/api"
  ).replace(/\/$/, "");
  return { token, baseUrl };
}

export function mobilizConfigured(): boolean {
  return getMobilizConfig() !== null;
}

async function mobilizGet<T>(path: string): Promise<T> {
  const cfg = getMobilizConfig();
  if (!cfg) throw new Error("Mobiliz yapılandırılmadı (MOBILIZ_TOKEN yok)");

  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      "Mobiliz-Token": cfg.token,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mobiliz HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as MobilizEnvelope<T> | T;
  if (data && typeof data === "object" && "result" in data) {
    const env = data as MobilizEnvelope<T>;
    if (env.success === false) {
      throw new Error(env.message || "Mobiliz API success=false");
    }
    return env.result as T;
  }
  return data as T;
}

/** Plakayı karşılaştırma için normalize et (boşluk/tire kaldır, büyük harf). */
export function normalizePlaka(plaka: string): string {
  return plaka
    .toLocaleUpperCase("tr-TR")
    .replace(/[\s\-_.]/g, "")
    .trim();
}

/**
 * Son aktivite listesini çeker. Tanım listesi olmadan da plaka eşlemesi yapılabilir;
 * activity/last genelde plaka + koordinat içerir.
 */
export async function fetchMobilizActivityLast(): Promise<MobilizVehicleLive[]> {
  const rows = await mobilizGet<MobilizActivity[]>("/activity/last");
  const list = Array.isArray(rows) ? rows : [];

  return list
    .map((a) => ({
      muId: a.muId,
      plate: a.plate ?? "",
      lat: Number(a.latitude),
      lng: Number(a.longitude),
      hiz: Number(a.speed) || 0,
      zaman: a.dataTime || a.gpsTime || "",
    }))
    .filter(
      (v) =>
        v.plate &&
        Number.isFinite(v.lat) &&
        Number.isFinite(v.lng) &&
        !(v.lat === 0 && v.lng === 0),
    );
}

/** Bağlantı testi — activity/last veya boş sonuç başarılı sayılır. */
export async function testMobilizConnection(): Promise<{
  connected: boolean;
  vehicleCount: number;
  error?: string;
}> {
  if (!mobilizConfigured()) {
    return { connected: false, vehicleCount: 0, error: "MOBILIZ_TOKEN tanımlı değil" };
  }
  try {
    const vehicles = await fetchMobilizActivityLast();
    return { connected: true, vehicleCount: vehicles.length };
  } catch (e) {
    return {
      connected: false,
      vehicleCount: 0,
      error: e instanceof Error ? e.message : "Bilinmeyen hata",
    };
  }
}
