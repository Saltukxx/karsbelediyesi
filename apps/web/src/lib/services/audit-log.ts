import { z } from "zod";
import { type Prisma, prisma } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import {
  opsiyonelMetin,
  opsiyonelTarih,
  rolGerekli,
  type ServiceActor,
} from "@/lib/services/base";

/** Denetim sayfasının varsayılan sayfa boyutu (web ile aynı) */
const VARSAYILAN_BOYUT = 50;
const AZAMI_BOYUT = 200;

export const denetimSorguSchema = z.object({
  kullanici: opsiyonelMetin,
  islem: opsiyonelMetin,
  varlik: opsiyonelMetin,
  baslangic: opsiyonelTarih(),
  bitis: opsiyonelTarih(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(AZAMI_BOYUT).default(VARSAYILAN_BOYUT),
});

export interface DenetimKaydiDTO {
  id: string;
  zaman: Date;
  userAd: string;
  rol: string;
  islem: string;
  varlik: string | null;
  varlikId: string | null;
  /** Ham JSON; istemci okunur tek satıra çevirir */
  detay: unknown;
}

export interface DenetimListesiDTO {
  kayitlar: DenetimKaydiDTO[];
  toplam: number;
  page: number;
  size: number;
  toplamSayfa: number;
  /** Filtre açılır listeleri; kayıtlardan türetilir */
  islemler: string[];
  varliklar: string[];
}

/**
 * Denetim izi listesi. Web sayfasıyla aynı filtre ve sıralama kurallarını
 * uygular: en yeni kayıt başta, kullanıcı adı kısmi arama, işlem/varlık tam
 * eşleşme, tarih aralığı gün sonuna kadar dahil.
 */
export async function denetimListesi(
  actor: ServiceActor,
  input: unknown,
): Promise<DenetimListesiDTO> {
  rolGerekli(actor, ACTION_ROLES.audit);
  const sorgu = denetimSorguSchema.parse(input ?? {});

  const where: Prisma.AuditLogWhereInput = {};
  if (sorgu.kullanici) {
    where.userAd = { contains: sorgu.kullanici, mode: "insensitive" };
  }
  if (sorgu.islem) where.islem = sorgu.islem;
  if (sorgu.varlik) where.varlik = sorgu.varlik;
  if (sorgu.baslangic || sorgu.bitis) {
    where.createdAt = {
      ...(sorgu.baslangic ? { gte: sorgu.baslangic } : {}),
      // Bitiş tarihi gün sonuna kadar dahil edilir
      ...(sorgu.bitis ? { lte: gunSonu(sorgu.bitis) } : {}),
    };
  }

  const [toplam, kayitlar, islemler, varliklar] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (sorgu.page - 1) * sorgu.size,
      take: sorgu.size,
    }),
    prisma.auditLog.findMany({
      distinct: ["islem"],
      select: { islem: true },
      orderBy: { islem: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["varlik"],
      select: { varlik: true },
      where: { varlik: { not: null } },
      orderBy: { varlik: "asc" },
    }),
  ]);

  return {
    kayitlar: kayitlar.map((k) => ({
      id: k.id,
      zaman: k.createdAt,
      userAd: k.userAd,
      rol: k.rol,
      islem: k.islem,
      varlik: k.varlik,
      varlikId: k.varlikId,
      detay: k.detay,
    })),
    toplam,
    page: sorgu.page,
    size: sorgu.size,
    toplamSayfa: Math.max(1, Math.ceil(toplam / sorgu.size)),
    islemler: islemler.map((i) => i.islem),
    varliklar: varliklar.flatMap((v) => (v.varlik ? [v.varlik] : [])),
  };
}

/** Yalnızca gün verilen tarihi 23:59:59.999'a çeker. */
function gunSonu(tarih: Date): Date {
  const son = new Date(tarih);
  son.setHours(23, 59, 59, 999);
  return son;
}
