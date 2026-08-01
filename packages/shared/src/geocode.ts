/**
 * Kars sınırlı Nominatim geocode — WhatsApp AI adresi ve panel
 * "Adresten bul" aynı fonksiyonu kullanır. LLM koordinat üretmez.
 *
 * Nominatim kullanım politikası: en fazla ~1 istek/sn, tanımlı User-Agent.
 * Sokak seviyesi OSM'de zayıf olduğundan adres bulunamazsa mahalle
 * merkezine düşülür (ısı haritası için yeterli).
 */

/** lon1,lat1,lon2,lat2 — RoadMap ile aynı Kars kutusu */
export const KARS_VIEWBOX = "42.9,40.65,43.3,40.55";

const USER_AGENT = "KarsBelediyesiPanel/1.0 (gbsoft; https://gbsoftt.com)";
const MIN_ARALIK_MS = 1100;

export type GeocodeGirdi = {
  mahalle?: string | null;
  adres?: string | null;
};

export type GeocodeSonuc = {
  lat: number;
  lng: number;
  displayName: string;
};

let sonIstekMs = 0;

async function nominatimBekle(): Promise<void> {
  const simdi = Date.now();
  const bekle = sonIstekMs + MIN_ARALIK_MS - simdi;
  if (bekle > 0) {
    await new Promise((r) => setTimeout(r, bekle));
  }
  sonIstekMs = Date.now();
}

/** Nominatim sorgu metni; adres/mahalle yoksa null. */
export function geocodeSorguMetni(girdi: GeocodeGirdi): string | null {
  const adres = girdi.adres?.trim() ?? "";
  const mahalle = girdi.mahalle?.trim() ?? "";
  if (!adres && !mahalle) return null;
  return [adres, mahalle, "Kars"].filter(Boolean).join(", ");
}

async function nominatimAra(
  q: string,
  bounded: boolean,
): Promise<GeocodeSonuc | null> {
  await nominatimBekle();
  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    countrycodes: "tr",
    viewbox: KARS_VIEWBOX,
    limit: "1",
  });
  if (bounded) params.set("bounded", "1");

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  const ilk = data[0];
  if (!ilk) return null;

  const lat = Number(ilk.lat);
  const lng = Number(ilk.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, displayName: ilk.display_name };
}

/**
 * Adres/mahalle metnini Kars viewbox içinde koordinata çevirir.
 * Hata veya sonuç yoksa null — çağıran şikayeti yine oluşturmalıdır.
 */
export async function geocodeKarsAdres(
  girdi: GeocodeGirdi,
): Promise<GeocodeSonuc | null> {
  const adres = girdi.adres?.trim() ?? "";
  const mahalle = girdi.mahalle?.trim() ?? "";
  if (!adres && !mahalle) return null;

  // Tam sorgu → (başarısızsa) sınırsız viewbox → mahalle merkezi
  const adaylar: Array<{ q: string; bounded: boolean }> = [];
  const tam = [adres, mahalle, "Kars"].filter(Boolean).join(", ");
  adaylar.push({ q: tam, bounded: true });
  adaylar.push({ q: tam, bounded: false });
  if (adres && mahalle) {
    adaylar.push({ q: `${mahalle}, Kars`, bounded: true });
  }

  try {
    for (const aday of adaylar) {
      const sonuc = await nominatimAra(aday.q, aday.bounded);
      if (sonuc) return sonuc;
    }
    return null;
  } catch {
    return null;
  }
}
