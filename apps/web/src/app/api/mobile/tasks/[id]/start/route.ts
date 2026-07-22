import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { assertTaskApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionTask } from "@/lib/domain/task-status";
import { requireMobileUser } from "@/lib/mobile-auth";
import { auditKaydet } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await assertTaskApiAccess(toAccessUser(user), id);
  if (access instanceof Response) return access;

  const transition = canTransitionTask(access.row.durum, "DEVAM_EDIYOR");
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { kmSayacCikis?: number };
  const gorev = access.row;
  const cikis = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTask.update({
      where: { id },
      data: {
        cikisTarihi: gorev.cikisTarihi ?? cikis,
        kmSayacCikis: body.kmSayacCikis ?? gorev.kmSayacCikis,
        durum: "DEVAM_EDIYOR",
        driverId: gorev.driverId ?? user.id,
      },
    });
    await tx.vehicle.update({
      where: { id: gorev.vehicleId },
      data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: cikis },
    });
  });

  await auditKaydet({ user }, "GOREV_BASLAT", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo, kaynak: "api-mobile" },
  });

  return NextResponse.json({ ok: true });
}
