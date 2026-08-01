import { departmentScope } from "@/lib/authz";
import { akaryakitAnalizi, AY_LISTESI } from "@/lib/akaryakit-analiz";
import { ok, panelRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/** Akaryakıt tüketim analizi + aylık rapor (web `/akaryakit` sayfasının verisi). */
export async function GET(req: Request) {
  return panelRoute(req, async (session) => {
    const url = new URL(req.url);
    const kapsam = departmentScope(session);
    const analiz = await akaryakitAnalizi({
      departmentId: kapsam.departmentId ?? url.searchParams.get("mudurluk"),
      ay: url.searchParams.get("ay"),
    });
    return ok({ ...analiz, aylar: AY_LISTESI });
  });
}
