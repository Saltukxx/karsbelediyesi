import { created, ok, panelRoute, readFormData, readJson } from "@/lib/api-route";
import { formVerisi } from "@/lib/services/base";
import { engelOlustur, haritaKatmanlari } from "@/lib/services/harita";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => {
    const katmanlar = await haritaKatmanlari(actor);
    return ok(katmanlar.engeller);
  });
}

/**
 * Fotoğraflı kayıt `multipart/form-data` ile gelir (mobil kamera akışı);
 * fotoğrafsız istemciler düz JSON gönderebilir.
 */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const multipart = (req.headers.get("content-type") ?? "").includes(
      "multipart/form-data",
    );
    if (!multipart) {
      return created(await engelOlustur(actor, await readJson(req)));
    }

    const formData = await readFormData(req);
    const photos = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    return created(await engelOlustur(actor, formVerisi(formData), photos));
  });
}
