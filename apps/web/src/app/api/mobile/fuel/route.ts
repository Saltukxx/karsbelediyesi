import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { yakitTutari } from "@kars/shared";
import { assertVehicleApiAccess, toAccessUser } from "@/lib/access";
import { fuelCreateSchema } from "@/lib/api-schemas";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["ADMIN", "DEPARTMENT_MANAGER", "DRIVER", "FIELD_WORKER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = fuelCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const access = await assertVehicleApiAccess(toAccessUser(user), body.vehicleId);
  if (access instanceof Response) return access;

  const personnel = await prisma.personnel.findFirst({ where: { userId: user.id } });

  const record = await prisma.fuelRecord.create({
    data: {
      vehicleId: body.vehicleId,
      tarih: new Date(),
      yakitTuru: (body.yakitTuru as never) ?? "MOTORIN",
      litre: body.litre,
      birimFiyat: body.birimFiyat,
      tutar: yakitTutari(body.litre, body.birimFiyat),
      sayac: body.sayac,
      sorumluPersonelId: personnel?.id,
    },
  });

  return NextResponse.json(record);
}
