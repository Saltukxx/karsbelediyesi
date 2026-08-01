import { prisma } from "@kars/db";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { sayfa, sayfali } from "@/lib/api/pagination";
import { PERSONEL_INCLUDE, personelDto } from "@/lib/api/personnel-dto";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { personelOlustur } from "@/lib/services/personnel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async ({ user }) => {
    const url = new URL(req.url);
    const arama = url.searchParams.get("q")?.trim();
    const durum = url.searchParams.get("durum")?.trim();
    const p = sayfa(req);

    const where = {
      ...departmentWhere(toAccessUser(user)),
      ...(durum ? { durum: durum as never } : {}),
      ...(arama
        ? {
            OR: [
              { adSoyad: { contains: arama, mode: "insensitive" as const } },
              { unvan: { contains: arama, mode: "insensitive" as const } },
              { telefon: { contains: arama } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.personnel.findMany({
        where,
        include: PERSONEL_INCLUDE,
        orderBy: { adSoyad: "asc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.personnel.count({ where }),
    ]);

    return ok(sayfali(rows.map(personelDto), total, p));
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const personel = await personelOlustur(actor, await readJson(req));
    const tam = await prisma.personnel.findUniqueOrThrow({
      where: { id: personel.id },
      include: PERSONEL_INCLUDE,
    });
    return created(personelDto(tam));
  });
}
