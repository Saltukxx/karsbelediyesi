import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * Offline kuyruktan senkron: submission + results upsert.
 */
export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    templateId: string;
    vehicleId: string;
    ay: number;
    yilDonem: number;
    sorumluOperatorTeknisyen?: string;
    santiyeLokasyon?: string;
    results: Array<{
      templateItemId: string;
      periyot: "HAFTA_1" | "HAFTA_2" | "HAFTA_3" | "HAFTA_4" | "AYLIK_BAKIM";
      sonuc: "UYGUN" | "ARIZALI" | "DIKKAT_GEREKLI";
      aciklamaNot?: string;
    }>;
  };

  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.checklistSubmission.upsert({
      where: {
        templateId_vehicleId_ay_yilDonem: {
          templateId: body.templateId,
          vehicleId: body.vehicleId,
          ay: body.ay,
          yilDonem: body.yilDonem,
        },
      },
      create: {
        templateId: body.templateId,
        vehicleId: body.vehicleId,
        ay: body.ay,
        yilDonem: body.yilDonem,
        sorumluOperatorTeknisyen: body.sorumluOperatorTeknisyen,
        santiyeLokasyon: body.santiyeLokasyon,
        operatorId: user.id,
        durum: "ONAY_BEKLIYOR",
      },
      update: {
        sorumluOperatorTeknisyen: body.sorumluOperatorTeknisyen,
        santiyeLokasyon: body.santiyeLokasyon,
        durum: "ONAY_BEKLIYOR",
      },
    });

    for (const r of body.results ?? []) {
      await tx.checklistItemResult.upsert({
        where: {
          submissionId_templateItemId_periyot: {
            submissionId: sub.id,
            templateItemId: r.templateItemId,
            periyot: r.periyot,
          },
        },
        create: {
          submissionId: sub.id,
          templateItemId: r.templateItemId,
          periyot: r.periyot,
          sonuc: r.sonuc,
          aciklamaNot: r.aciklamaNot,
        },
        update: {
          sonuc: r.sonuc,
          aciklamaNot: r.aciklamaNot,
        },
      });
    }

    return sub;
  });

  return NextResponse.json(submission);
}
