import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { gorevSuresiSaatTarihli, kmFarki } from "@kars/shared";
import { assertTaskApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionTask, validateKmPair } from "@/lib/domain/task-status";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await assertTaskApiAccess(toAccessUser(user), id);
  if (access instanceof Response) return access;

  const body = (await req.json().catch(() => ({}))) as {
    kmSayacGiris?: number;
    durum?: "TAMAMLANDI" | "IPTAL_EDILDI";
  };
  const gorev = access.row;
  const durum = body.durum ?? "TAMAMLANDI";

  const transition = canTransitionTask(gorev.durum, durum);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const kmCheck = validateKmPair(gorev.kmSayacCikis, body.kmSayacGiris);
  if (!kmCheck.ok) {
    return NextResponse.json({ error: kmCheck.error }, { status: 400 });
  }

  const giris = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTask.update({
      where: { id },
      data: {
        girisTarihi: giris,
        sureSaat: gorev.cikisTarihi
          ? gorevSuresiSaatTarihli(gorev.cikisTarihi, giris)
          : gorev.sureSaat,
        kmSayacGiris: body.kmSayacGiris ?? gorev.kmSayacGiris,
        kmFarki:
          gorev.kmSayacCikis != null && body.kmSayacGiris != null
            ? kmFarki(gorev.kmSayacCikis, body.kmSayacGiris)
            : gorev.kmFarki,
        durum,
      },
    });
    const otherActive = await tx.vehicleTask.count({
      where: {
        vehicleId: gorev.vehicleId,
        durum: "DEVAM_EDIYOR",
        id: { not: id },
      },
    });
    if (otherActive === 0) {
      await tx.vehicle.update({
        where: { id: gorev.vehicleId },
        data: {
          operasyonDurumu: "MUSAIT",
          sonGirisTarihi: giris,
          ...(body.kmSayacGiris != null ? { sayacDeger: body.kmSayacGiris } : {}),
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
