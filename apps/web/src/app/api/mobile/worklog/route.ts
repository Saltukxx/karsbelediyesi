import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import {
  normalSaatHesapla,
  mesaiSaatHesapla,
  toplamSaatHesapla,
} from "@kars/shared";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    girisSaati: string;
    cikisSaati: string;
    yapilanIs?: string;
  };

  let personnel = await prisma.personnel.findFirst({ where: { userId: user.id } });
  if (!personnel) {
    personnel = await prisma.personnel.create({
      data: {
        adSoyad: user.name,
        telefon: user.phone,
        userId: user.id,
        departmentId: user.departmentId,
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const log = await prisma.personnelWorkLog.upsert({
    where: {
      personnelId_tarih: { personnelId: personnel.id, tarih: today },
    },
    create: {
      personnelId: personnel.id,
      tarih: today,
      girisSaati: body.girisSaati,
      cikisSaati: body.cikisSaati,
      normalSaat: normalSaatHesapla(body.girisSaati, body.cikisSaati),
      mesaiSaat: mesaiSaatHesapla(body.girisSaati, body.cikisSaati),
      toplamSaat: toplamSaatHesapla(body.girisSaati, body.cikisSaati),
      yapilanIs: body.yapilanIs,
    },
    update: {
      girisSaati: body.girisSaati,
      cikisSaati: body.cikisSaati,
      normalSaat: normalSaatHesapla(body.girisSaati, body.cikisSaati),
      mesaiSaat: mesaiSaatHesapla(body.girisSaati, body.cikisSaati),
      toplamSaat: toplamSaatHesapla(body.girisSaati, body.cikisSaati),
      yapilanIs: body.yapilanIs,
    },
  });

  return NextResponse.json(log);
}
