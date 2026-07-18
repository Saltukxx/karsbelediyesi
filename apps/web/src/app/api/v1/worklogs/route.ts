import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "DRIVER",
    "FIELD_WORKER",
  ]);
  if (forbidden) return forbidden;

  const [personel, arac] = await Promise.all([
    prisma.personnelWorkLog.findMany({
      include: { personnel: { select: { adSoyad: true } } },
      orderBy: { tarih: "desc" },
      take: 100,
    }),
    prisma.vehicleWorkLog.findMany({
      include: { vehicle: { select: { plaka: true } }, driver: { select: { name: true } } },
      orderBy: { tarih: "desc" },
      take: 100,
    }),
  ]);

  const rows = [
    ...personel.map((r) => ({
      id: r.id,
      tarih: r.tarih.toISOString(),
      personelAdi: r.personnel.adSoyad,
      plaka: null as string | null,
      baslangic: r.girisSaati,
      bitis: r.cikisSaati,
      durum: r.calismaTipi,
    })),
    ...arac.map((r) => ({
      id: r.id,
      tarih: r.tarih.toISOString(),
      personelAdi: r.driver?.name ?? r.soforAdi,
      plaka: r.vehicle.plaka,
      baslangic: r.girisSaati,
      bitis: r.cikisSaati,
      durum: "ARAC",
    })),
  ].sort((a, b) => (b.tarih ?? "").localeCompare(a.tarih ?? ""));

  return json(rows);
}
