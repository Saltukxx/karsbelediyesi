import { ok, panelRoute, readJson } from "@/lib/api-route";
import { stokHesapla, uretimToplamlari } from "@/lib/beton-stok";
import { betonStokGiris } from "@/lib/services/concrete";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const stok = await betonStokGiris(actor, await readJson(req));
    const { cikis, kalanStok, durum } = stokHesapla(stok, await uretimToplamlari());
    return ok({
      id: stok.id,
      malzeme: stok.malzeme,
      birim: stok.birim,
      baslangicStok: stok.baslangicStok,
      toplamGiris: stok.toplamGiris,
      toplamCikis: cikis,
      kalanStok,
      kritikSeviye: stok.kritikSeviye,
      durum,
    });
  });
}
