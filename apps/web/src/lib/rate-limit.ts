import { getRedis } from "@/lib/redis";

/** Kilit penceresi (saniye). */
const PENCERE_SN = 15 * 60;
/** Pencere içinde izin verilen başarısız giriş sayısı. */
const MAKS_BASARISIZ = 10;

const globalForLimit = globalThis as unknown as {
  girisLimitBellek?: Map<string, { sayi: number; sonGecerlilik: number }>;
};

/**
 * Sayaç Redis'te tutulur: anahtarlar TTL ile kendiliğinden silindiği için
 * bellek büyümez ve birden fazla web örneği aynı sayacı görür.
 *
 * Redis erişilemezse süreç içi belleğe düşülür. Bu durumda kilit örnek başına
 * çalışır, yani koruma zayıflar ama girişler tamamen engellenmez.
 */
function redis() {
  return getRedis();
}

function bellek(): Map<string, { sayi: number; sonGecerlilik: number }> {
  globalForLimit.girisLimitBellek ??= new Map();
  return globalForLimit.girisLimitBellek;
}

/** Süresi dolmuş kayıtları atar; yedek yolun sınırsız büyümesini engeller. */
function bellegiBudama(simdi: number) {
  const harita = bellek();
  for (const [anahtar, kayit] of harita) {
    if (kayit.sonGecerlilik <= simdi) harita.delete(anahtar);
  }
}

function anahtar(ip: string, phone: string): string {
  return `giris-limit:${ip}|${phone}`;
}

/**
 * Bu (ip, telefon) çifti için giriş kilitli mi?
 *
 * Sayaç yalnızca başarısız denemelerde artar; meşru bir kullanıcının arka
 * arkaya birkaç kez oturum açması (token yenileme, farklı cihaz) kilide
 * yol açmaz.
 */
export async function girisKilitliMi(ip: string, phone: string): Promise<boolean> {
  const k = anahtar(ip, phone);
  const istemci = redis();
  if (istemci) {
    try {
      const deger = await istemci.get(k);
      return Number(deger ?? 0) >= MAKS_BASARISIZ;
    } catch {
      // Redis düştü; yedek yola geç.
    }
  }
  const simdi = Date.now();
  const kayit = bellek().get(k);
  if (!kayit || kayit.sonGecerlilik <= simdi) return false;
  return kayit.sayi >= MAKS_BASARISIZ;
}

/** Başarısız denemeyi sayar ve pencerenin bitişini tazeler. */
export async function basarisizGirisKaydet(ip: string, phone: string): Promise<void> {
  const k = anahtar(ip, phone);
  const istemci = redis();
  if (istemci) {
    try {
      const sayi = await istemci.incr(k);
      // İlk denemede pencereyi başlat; sonrakiler mevcut TTL'i korur.
      if (sayi === 1) await istemci.expire(k, PENCERE_SN);
      return;
    } catch {
      // Redis düştü; yedek yola geç.
    }
  }
  const simdi = Date.now();
  bellegiBudama(simdi);
  const harita = bellek();
  const kayit = harita.get(k);
  if (!kayit || kayit.sonGecerlilik <= simdi) {
    harita.set(k, { sayi: 1, sonGecerlilik: simdi + PENCERE_SN * 1000 });
    return;
  }
  kayit.sayi += 1;
}

/** Başarılı girişten sonra sayacı sıfırlar. */
export async function girisDenemeleriniSifirla(ip: string, phone: string): Promise<void> {
  const k = anahtar(ip, phone);
  const istemci = redis();
  if (istemci) {
    try {
      await istemci.del(k);
      return;
    } catch {
      // Redis düştü; yedek yola geç.
    }
  }
  bellek().delete(k);
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
