import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Örnek başına açılacak veritabanı bağlantısı sayısı.
 *
 * Prisma varsayılanı `cpu*2+1` olduğu için 16 çekirdekli bir sunucuda tek web
 * örneği 33 bağlantı açar; PostgreSQL varsayılanı `max_connections=100` ile
 * dördüncü örnek ayağa kalkarken bağlantılar tükenir ve hata uygulamadan değil
 * veritabanından gelir. Sabit bir tavan koymak bu sınırı makineden bağımsız
 * ve öngörülebilir kılar.
 *
 * 10 bağlantı ölçülen yük için bolca yeterli: 340 istek/sn altında eşzamanlı
 * aktif sorgu sayısı 1-2 seviyesindeydi. Aynı zamanda 100 bağlantılık
 * varsayılan tavanda bakım oturumlarına yer bırakarak 9 örneğe kadar
 * yatay ölçeklemeye izin verir.
 */
const VARSAYILAN_BAGLANTI_SINIRI = 10;

/** Havuz doluyken bir isteğin bağlantı bekleyeceği süre (saniye). */
const VARSAYILAN_HAVUZ_ZAMAN_ASIMI = 15;

function sayiOku(deger: string | undefined, varsayilan: number): number {
  const sayi = Number(deger);
  return Number.isFinite(sayi) && sayi > 0 ? sayi : varsayilan;
}

/**
 * Bağlantı dizesine havuz parametrelerini ekler. Dizede zaten elle verilmiş
 * bir değer varsa ona dokunulmaz — dağıtım tarafındaki açık tercih kazanır.
 */
function havuzluBaglantiDizesi(ham: string | undefined): string | undefined {
  if (!ham) return ham;
  let url: URL;
  try {
    url = new URL(ham);
  } catch {
    // Prisma'nın kendi hata mesajı daha açıklayıcı; dizeyi olduğu gibi geçir.
    return ham;
  }
  if (!url.searchParams.has("connection_limit")) {
    const sinir = sayiOku(process.env.DB_CONNECTION_LIMIT, VARSAYILAN_BAGLANTI_SINIRI);
    url.searchParams.set("connection_limit", String(sinir));
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", String(VARSAYILAN_HAVUZ_ZAMAN_ASIMI));
  }
  return url.toString();
}

const baglantiDizesi = havuzluBaglantiDizesi(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(baglantiDizesi ? { datasources: { db: { url: baglantiDizesi } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export {
  nextComplaintSerial,
  nextTaskSerial,
  withSerialRetry,
  isUniqueViolation,
} from "./serial";
