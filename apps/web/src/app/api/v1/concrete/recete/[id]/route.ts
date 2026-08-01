import { suCimentoOrani, toplamKarisimKg, yogunlukKontrolu } from "@kars/shared";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { betonReceteGuncelle } from "@/lib/services/concrete";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return panelRoute(req, async (actor) => {
    const { id } = await params;
    const r = await betonReceteGuncelle(actor, id, await readJson(req));
    const toplam = toplamKarisimKg(
      r.cimentoKg,
      r.kumKg,
      r.micir05Kg,
      r.micir512Kg,
      r.micir1219Kg,
      r.suLt,
      r.katkiKg,
    );
    return ok({
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
      suCimentoOrani: suCimentoOrani(r.suLt, r.cimentoKg),
      toplamKarisimKg: toplam,
      yogunlukDurumu: yogunlukKontrolu(toplam),
    });
  });
}
