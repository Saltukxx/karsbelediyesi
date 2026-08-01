import { iso } from "@/lib/api/serialize";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { bitumAyarKaydet } from "@/lib/services/bitum";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const s = await bitumAyarKaydet(actor, await readJson(req));
    return ok({
      depoKapasitesiTon: s.depoKapasitesiTon,
      mesafeKm: s.mesafeKm,
      tirKapasiteTon: s.tirKapasiteTon,
      yakitTlKm: s.yakitTlKm,
      seferMaliyetiTl: s.seferMaliyetiTl,
      tonTasimaTl: s.tonTasimaTl,
      referansAlisFiyat: s.referansAlisFiyat,
      kritikEsik: s.kritikEsik,
      dusukEsik: s.dusukEsik,
      updatedAt: iso(s.updatedAt),
    });
  });
}
