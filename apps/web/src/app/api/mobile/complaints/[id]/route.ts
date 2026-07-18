import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { assertComplaintApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await assertComplaintApiAccess(toAccessUser(user), id);
  if (access instanceof Response) return access;

  const body = (await req.json()) as {
    durum?: "ACIK" | "DEVAM_EDIYOR" | "KAPATILDI" | "IPTAL";
    cozumNotu?: string;
    lat?: number;
    lng?: number;
  };

  if (body.durum) {
    const transition = canTransitionComplaint(access.row.durum, body.durum, user.role);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.update({
      where: { id },
      data: {
        ...(body.durum ? { durum: body.durum } : {}),
        ...(body.cozumNotu !== undefined ? { cozumNotu: body.cozumNotu } : {}),
        ...(body.lat != null ? { lat: body.lat } : {}),
        ...(body.lng != null ? { lng: body.lng } : {}),
        ...(body.durum === "KAPATILDI"
          ? { kapanisTarihi: new Date(), onaylayanId: user.id }
          : {}),
      },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: id,
        userId: user.id,
        tip: "MOBIL_GUNCELLEME",
        detay: body,
      },
    });
    return c;
  });

  return NextResponse.json(updated);
}
