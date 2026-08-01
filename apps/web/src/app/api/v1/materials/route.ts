import { prisma, StokHareketTipi } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { num, numOr } from "@/lib/api/serialize";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { malzemeOlustur } from "@/lib/services/materials";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const url = new URL(req.url);
    const arama = url.searchParams.get("q")?.trim();
    const kategori = url.searchParams.get("kategori")?.trim();
    const sadeceKritik = url.searchParams.get("kritik") === "1";
    const p = sayfa(req);

    const where = {
      aktif: true,
      ...(kategori ? { kategori } : {}),
      ...(arama
        ? {
            OR: [
              { ad: { contains: arama, mode: "insensitive" as const } },
              { kod: { contains: arama, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total, kategoriler] = await Promise.all([
      prisma.material.findMany({
        where,
        include: { movements: { select: { tip: true, miktar: true } } },
        orderBy: { ad: "asc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.material.count({ where }),
      prisma.material.findMany({
        where: { aktif: true },
        distinct: ["kategori"],
        select: { kategori: true },
        orderBy: { kategori: "asc" },
      }),
    ]);

    const items = rows.map((m) => {
      const giris = topla(m.movements, StokHareketTipi.GIRIS);
      const cikis = topla(m.movements, StokHareketTipi.CIKIS);
      const stok = mevcutStok(giris, cikis);
      return {
        id: m.id,
        kod: m.kod,
        ad: m.ad,
        kategori: m.kategori,
        birim: m.birim,
        depoLokasyon: m.depoLokasyon,
        stokMiktari: stok,
        toplamGiris: giris,
        toplamCikis: cikis,
        kritikStok: m.kritikStok,
        kritikMi: stok <= m.kritikStok,
        birimFiyat: num(m.birimFiyat),
        stokDegeri: stok * numOr(m.birimFiyat),
        aciklama: m.aciklama,
      };
    });

    return ok({
      ...sayfali(
        sadeceKritik ? items.filter((i) => i.kritikMi) : items,
        sadeceKritik ? items.filter((i) => i.kritikMi).length : total,
        p,
      ),
      kategoriler: kategoriler.map((k) => k.kategori),
    });
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const malzeme = await malzemeOlustur(actor, await readJson(req));
    return created({
      id: malzeme.id,
      kod: malzeme.kod,
      ad: malzeme.ad,
      kategori: malzeme.kategori,
      birim: malzeme.birim,
      kritikStok: malzeme.kritikStok,
      birimFiyat: num(malzeme.birimFiyat),
    });
  });
}

function topla(
  movements: { tip: StokHareketTipi; miktar: unknown }[],
  tip: StokHareketTipi,
): number {
  return movements
    .filter((m) => m.tip === tip)
    .reduce((s, m) => s + Number(m.miktar), 0);
}
