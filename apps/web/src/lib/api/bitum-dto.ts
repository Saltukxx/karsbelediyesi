import type { Prisma } from "@kars/db";
import { iso } from "@/lib/api/serialize";

export const BITUM_HAREKET_INCLUDE = {
  depo: { select: { id: true, ad: true } },
  kaynakDepo: { select: { id: true, ad: true } },
  hedefDepo: { select: { id: true, ad: true } },
  kullanimDepo: { select: { id: true, ad: true } },
} as const;

type BitumHareket = Prisma.BitumMovementGetPayload<{
  include: typeof BITUM_HAREKET_INCLUDE;
}>;

export function bitumHareketDto(r: BitumHareket) {
  return {
    id: r.id,
    tarih: iso(r.tarih),
    tip: r.tip,
    miktarTon: r.miktarTon,
    depoId: r.depoId,
    depoAdi: r.depo?.ad ?? null,
    kaynakDepoId: r.kaynakDepoId,
    kaynakDepoAdi: r.kaynakDepo?.ad ?? null,
    hedefDepoId: r.hedefDepoId,
    hedefDepoAdi: r.hedefDepo?.ad ?? null,
    kullanimDepoId: r.kullanimDepoId,
    kullanimDepoAdi: r.kullanimDepo?.ad ?? null,
    // Excel maliyet modelinin sunucuda hesaplanan kolonları
    alisFiyati: r.alisFiyati,
    alisMaliyeti: r.alisMaliyeti,
    tirSeferSayisi: r.tirSeferSayisi,
    tasimaMaliyeti: r.tasimaMaliyeti,
    kaynakOrtFiyat: r.kaynakOrtFiyat,
    varisMaliyetiTon: r.varisMaliyetiTon,
    toplamMaliyet: r.toplamMaliyet,
    aciklama: r.aciklama,
    createdAt: iso(r.createdAt),
  };
}
