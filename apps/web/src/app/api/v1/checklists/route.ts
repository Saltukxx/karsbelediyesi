import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { kontrolFormuOlustur, kontrolListesi } from "@/lib/services/checklists";

export const dynamic = "force-dynamic";

/** Doldurulan formlar + şablonlar + form açılabilir araçlar. */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await kontrolListesi(actor)));
}

/** Yeni kontrol formu taslağı. */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const submission = await kontrolFormuOlustur(actor, await readJson(req));
    return created({
      id: submission.id,
      templateId: submission.templateId,
      vehicleId: submission.vehicleId,
      ay: submission.ay,
      yilDonem: submission.yilDonem,
      durum: submission.durum,
    });
  });
}
