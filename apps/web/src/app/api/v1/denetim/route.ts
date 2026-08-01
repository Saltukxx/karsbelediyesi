import { ok, panelRoute } from "@/lib/api-route";
import { denetimListesi } from "@/lib/services/audit-log";

export const dynamic = "force-dynamic";

/** Denetim izi listesi: kullanıcı/işlem/varlık/tarih filtreleri + sayfalama */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return panelRoute(req, async (actor) =>
    ok(
      await denetimListesi(actor, {
        kullanici: q.get("kullanici") ?? undefined,
        islem: q.get("islem") ?? undefined,
        varlik: q.get("varlik") ?? undefined,
        baslangic: q.get("baslangic") ?? undefined,
        bitis: q.get("bitis") ?? undefined,
        page: q.get("page") ?? undefined,
        size: q.get("size") ?? undefined,
      }),
    ),
  );
}
