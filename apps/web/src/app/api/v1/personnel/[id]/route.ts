import { prisma } from "@kars/db";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { gun, num } from "@/lib/api/serialize";
import { PERSONEL_INCLUDE, personelDto } from "@/lib/api/personnel-dto";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { personelGuncelle } from "@/lib/services/personnel";
import { ServiceError } from "@/lib/services/base";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return panelRoute(req, async ({ user }) => {
    const { id } = await params;
    const personel = await prisma.personnel.findFirst({
      where: { id, ...departmentWhere(toAccessUser(user)) },
      include: PERSONEL_INCLUDE,
    });
    if (!personel) throw new ServiceError("Personel bulunamadı", 404);

    const mesailer = await prisma.personnelWorkLog.findMany({
      where: { personnelId: id },
      orderBy: { tarih: "desc" },
      take: 60,
      select: {
        id: true,
        tarih: true,
        girisSaati: true,
        cikisSaati: true,
        normalSaat: true,
        mesaiSaat: true,
        toplamSaat: true,
        calismaTipi: true,
        yapilanIs: true,
      },
    });

    return ok({
      personel: personelDto(personel),
      mesailer: mesailer.map((m) => ({
        id: m.id,
        tarih: gun(m.tarih),
        girisSaati: m.girisSaati,
        cikisSaati: m.cikisSaati,
        normalSaat: m.normalSaat,
        mesaiSaat: m.mesaiSaat,
        toplamSaat: m.toplamSaat,
        calismaTipi: m.calismaTipi,
        yapilanIs: m.yapilanIs,
      })),
      // İşçilik maliyeti hesabı için toplam saatler
      ozet: {
        toplamMesaiSaat: mesailer.reduce((s, m) => s + m.mesaiSaat, 0),
        toplamSaat: mesailer.reduce((s, m) => s + m.toplamSaat, 0),
        saatUcret: num(personel.saatUcret),
      },
    });
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return panelRoute(req, async (actor) => {
    const { id } = await params;
    await personelGuncelle(actor, id, await readJson(req));
    const tam = await prisma.personnel.findUniqueOrThrow({
      where: { id },
      include: PERSONEL_INCLUDE,
    });
    return ok(personelDto(tam));
  });
}
