import { prisma } from "@kars/db";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { iso, num } from "@/lib/api/serialize";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { stokHareketOlustur } from "@/lib/services/materials";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const url = new URL(req.url);
    const materialId = url.searchParams.get("materialId")?.trim();
    const tip = url.searchParams.get("tip")?.trim();
    const p = sayfa(req);

    const where = {
      ...(materialId ? { materialId } : {}),
      ...(tip ? { tip: tip as never } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.materialMovement.findMany({
        where,
        include: {
          material: { select: { kod: true, ad: true, birim: true } },
          department: { select: { name: true } },
          vehicleTask: { select: { id: true, gorevNo: true } },
        },
        orderBy: { tarih: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.materialMovement.count({ where }),
    ]);

    return ok(
      sayfali(
        rows.map((r) => ({
          id: r.id,
          materialId: r.materialId,
          malzemeKodu: r.material.kod,
          malzemeAdi: r.material.ad,
          birim: r.material.birim,
          tarih: iso(r.tarih),
          tip: r.tip,
          miktar: num(r.miktar),
          departmentId: r.departmentId,
          mudurluk: r.department?.name ?? null,
          belgeNo: r.belgeNo,
          aciklama: r.aciklama,
          vehicleTaskId: r.vehicleTaskId,
          gorevNo: r.vehicleTask?.gorevNo ?? null,
          // Kış operasyonundan otomatik tuz düşümü ise elle düzenlenmez
          otomatikMi: r.winterOperationId != null,
        })),
        total,
        p,
      ),
    );
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const hareket = await stokHareketOlustur(actor, await readJson(req));
    return created({
      id: hareket.id,
      materialId: hareket.materialId,
      tarih: iso(hareket.tarih),
      tip: hareket.tip,
      miktar: num(hareket.miktar),
    });
  });
}
