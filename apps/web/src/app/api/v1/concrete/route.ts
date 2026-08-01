import { prisma } from "@kars/db";
import {
  suCimentoOrani,
  toplamAgregaKg,
  toplamKarisimKg,
  yogunlukKontrolu,
} from "@kars/shared";
import { gun } from "@/lib/api/serialize";
import { ok, panelRoute } from "@/lib/api-route";
import { stokHesapla, uretimToplamlari } from "@/lib/beton-stok";

export const dynamic = "force-dynamic";

/**
 * `/beton` sayfasının tamamı: reçeteler (türetilmiş kontrol değerleriyle),
 * son üretimler ve malzeme stokları.
 */
export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const [recipes, productions, stocks, cikisMap] = await Promise.all([
      prisma.concreteRecipe.findMany({
        where: { aktif: true },
        orderBy: { sinif: "asc" },
      }),
      prisma.concreteProduction.findMany({
        include: { recipe: { select: { sinif: true } } },
        orderBy: { tarih: "desc" },
        take: 100,
      }),
      prisma.concreteStock.findMany({ orderBy: { malzeme: "asc" } }),
      uretimToplamlari(),
    ]);

    return ok({
      receteler: recipes.map((r) => ({
        id: r.id,
        sinif: r.sinif,
        cimentoKg: r.cimentoKg,
        kumKg: r.kumKg,
        micir05Kg: r.micir05Kg,
        micir512Kg: r.micir512Kg,
        micir1219Kg: r.micir1219Kg,
        suLt: r.suLt,
        katkiKg: r.katkiKg,
        aciklama: r.aciklama,
        aktif: r.aktif,
        // Excel'in kontrol kolonları: su/çimento oranı ve 1 m³ yoğunluk kontrolü
        suCimentoOrani: suCimentoOrani(r.suLt, r.cimentoKg),
        toplamAgregaKg: toplamAgregaKg(
          r.kumKg,
          r.micir05Kg,
          r.micir512Kg,
          r.micir1219Kg,
        ),
        toplamKarisimKg: toplamKarisimKg(
          r.cimentoKg,
          r.kumKg,
          r.micir05Kg,
          r.micir512Kg,
          r.micir1219Kg,
          r.suLt,
          r.katkiKg,
        ),
        yogunlukDurumu: yogunlukKontrolu(
          toplamKarisimKg(
            r.cimentoKg,
            r.kumKg,
            r.micir05Kg,
            r.micir512Kg,
            r.micir1219Kg,
            r.suLt,
            r.katkiKg,
          ),
        ),
      })),
      uretimler: productions.map((p) => ({
        id: p.id,
        tarih: gun(p.tarih),
        recipeId: p.recipeId,
        sinif: p.recipe.sinif,
        hedefM3: p.hedefM3,
        cimentoKg: p.cimentoKg,
        kumKg: p.kumKg,
        micir05Kg: p.micir05Kg,
        micir512Kg: p.micir512Kg,
        micir1219Kg: p.micir1219Kg,
        suLt: p.suLt,
        katkiKg: p.katkiKg,
        notlar: p.notlar,
      })),
      stoklar: stocks.map((s) => {
        const { cikis, kalanStok, durum } = stokHesapla(s, cikisMap);
        return {
          id: s.id,
          malzeme: s.malzeme,
          birim: s.birim,
          baslangicStok: s.baslangicStok,
          toplamGiris: s.toplamGiris,
          toplamCikis: cikis,
          kalanStok,
          kritikSeviye: s.kritikSeviye,
          durum,
        };
      }),
      ozet: {
        toplamUretimM3: productions.reduce((s, p) => s + p.hedefM3, 0),
        uretimSayisi: productions.length,
      },
    });
  });
}
