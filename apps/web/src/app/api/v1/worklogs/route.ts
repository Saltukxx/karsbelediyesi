import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import {
  personelGunlukOlusturForUser,
  personelGunlukGuncelleForUser,
  personelGunlukSilForUser,
  aracGunlukOlusturForUser,
  aracGunlukGuncelleForUser,
  aracGunlukSilForUser,
} from "@/lib/domain/worklogs";

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
      take: listLimit(req, 100),
    }),
    prisma.vehicleWorkLog.findMany({
      include: { vehicle: { select: { plaka: true } }, driver: { select: { name: true } } },
      orderBy: { tarih: "desc" },
      take: listLimit(req, 100),
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

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.worklogs, (session, body) => {
    const kind = str(body, "kind");
    if (kind === "arac") {
      return aracGunlukOlusturForUser(session, {
        vehicleId: str(body, "vehicleId"),
        tarih: str(body, "tarih"),
        girisSaati: str(body, "girisSaati"),
        cikisSaati: str(body, "cikisSaati"),
        driverId: optStr(body, "driverId"),
        soforAdi: optStr(body, "soforAdi"),
        gorevTanimi: optStr(body, "gorevTanimi"),
        yerBolge: optStr(body, "yerBolge"),
        yakitLitre: optNum(body, "yakitLitre"),
        birimFiyat: optNum(body, "birimFiyat"),
        yakitTuru: optStr(body, "yakitTuru"),
        notlar: optStr(body, "notlar"),
      });
    }
    return personelGunlukOlusturForUser(session, {
      personnelId: str(body, "personnelId"),
      tarih: str(body, "tarih"),
      girisSaati: str(body, "girisSaati"),
      cikisSaati: str(body, "cikisSaati"),
      calismaTipi: optStr(body, "calismaTipi"),
      yapilanIs: optStr(body, "yapilanIs"),
      gorevlendirilenBirimId: optStr(body, "gorevlendirilenBirimId"),
      notlar: optStr(body, "notlar"),
    });
  });
}

export async function PATCH(req: Request) {
  return handleV1Write(req, ACTION_ROLES.worklogs, (session, body) => {
    const kind = str(body, "kind");
    if (kind === "arac") {
      return aracGunlukGuncelleForUser(session, {
        id: str(body, "id"),
        vehicleId: str(body, "vehicleId"),
        tarih: str(body, "tarih"),
        girisSaati: str(body, "girisSaati"),
        cikisSaati: str(body, "cikisSaati"),
        driverId: optStr(body, "driverId"),
        gorevTanimi: optStr(body, "gorevTanimi"),
        yakitLitre: optNum(body, "yakitLitre"),
        birimFiyat: optNum(body, "birimFiyat"),
        notlar: optStr(body, "notlar"),
      });
    }
    return personelGunlukGuncelleForUser(session, {
      id: str(body, "id"),
      personnelId: str(body, "personnelId"),
      tarih: str(body, "tarih"),
      girisSaati: str(body, "girisSaati"),
      cikisSaati: str(body, "cikisSaati"),
      calismaTipi: optStr(body, "calismaTipi"),
      yapilanIs: optStr(body, "yapilanIs"),
      notlar: optStr(body, "notlar"),
    });
  });
}

export async function DELETE(req: Request) {
  return handleV1Write(req, ACTION_ROLES.worklogs, (session, body) => {
    const id = str(body, "id");
    if (str(body, "kind") === "arac") return aracGunlukSilForUser(session, id);
    return personelGunlukSilForUser(session, id);
  });
}
