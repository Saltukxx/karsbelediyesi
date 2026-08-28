import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

export type ChecklistPeriyot =
  | "HAFTA_1"
  | "HAFTA_2"
  | "HAFTA_3"
  | "HAFTA_4"
  | "AYLIK_BAKIM";

export type ChecklistSonuc = "UYGUN" | "ARIZALI" | "DIKKAT_GEREKLI";

export async function kontrolFormuOlusturForUser(
  session: AppSession,
  input: {
    templateId: string;
    vehicleId: string;
    ay: number;
    yilDonem: number;
    sorumluOperatorTeknisyen?: string;
    santiyeLokasyon?: string;
  },
) {
  if (!input.templateId || !input.vehicleId) {
    throw new Error("Şablon ve araç zorunlu");
  }
  return prisma.checklistSubmission.create({
    data: {
      templateId: input.templateId,
      vehicleId: input.vehicleId,
      ay: input.ay,
      yilDonem: input.yilDonem,
      sorumluOperatorTeknisyen: input.sorumluOperatorTeknisyen,
      santiyeLokasyon: input.santiyeLokasyon,
      operatorId: session.user.id,
      durum: "TASLAK",
    },
  });
}

export async function kontrolKalemKaydetForUser(input: {
  submissionId: string;
  templateItemId: string;
  periyot: ChecklistPeriyot;
  sonuc: ChecklistSonuc;
  aciklamaNot?: string;
}) {
  await prisma.checklistItemResult.upsert({
    where: {
      submissionId_templateItemId_periyot: {
        submissionId: input.submissionId,
        templateItemId: input.templateItemId,
        periyot: input.periyot,
      },
    },
    create: {
      submissionId: input.submissionId,
      templateItemId: input.templateItemId,
      periyot: input.periyot,
      sonuc: input.sonuc,
      aciklamaNot: input.aciklamaNot,
    },
    update: { sonuc: input.sonuc, aciklamaNot: input.aciklamaNot },
  });

  if (input.sonuc !== "ARIZALI") return { ok: true };

  const sub = await prisma.checklistSubmission.findUniqueOrThrow({
    where: { id: input.submissionId },
    include: {
      results: {
        where: {
          templateItemId: input.templateItemId,
          periyot: input.periyot,
        },
        include: { templateItem: true },
      },
    },
  });
  const result = sub.results[0];
  if (!result) return { ok: true };
  const existing = await prisma.maintenanceRecord.findUnique({
    where: { kaynakChecklistItemResultId: result.id },
  });
  if (!existing) {
    await prisma.maintenanceRecord.create({
      data: {
        vehicleId: sub.vehicleId,
        bakimTarihi: new Date(),
        bakimTuru: "ARIZA_ONARIMI",
        yapilanIslemler: `Kontrol formu: ${result.templateItem.kontrolKalemi}`,
        durum: "PLANLANDI",
        kaynakChecklistItemResultId: result.id,
      },
    });
  }
  return { ok: true };
}

export async function kontrolFormuOnayaGonderForUser(
  session: AppSession,
  input: { id: string; teknisyenAdi?: string; sefAmirAdi?: string },
) {
  await prisma.checklistSubmission.update({
    where: { id: input.id },
    data: {
      durum: "ONAY_BEKLIYOR",
      teknisyenAdi: input.teknisyenAdi,
      sefAmirAdi: input.sefAmirAdi,
    },
  });
  await auditKaydet(session, "KONTROL_FORMU_ONAYA_GONDER", {
    varlik: "ChecklistSubmission",
    varlikId: input.id,
  });
  const onaylayanlar = await kullaniciIdleri(["APPROVER"]);
  await bildirimGonder(
    onaylayanlar.filter((uid) => uid !== session.user.id),
    {
      tip: "ONAY",
      baslik: "Kontrol formu onay bekliyor",
      mesaj: `${session.user.name} bir kontrol formunu onaya gönderdi.`,
      href: `/kontrol-listeleri/${input.id}`,
    },
  );
  return { ok: true };
}

export async function kontrolFormuOnaylaForUser(
  session: AppSession,
  input: { id: string; karar: "ONAYLANDI" | "REDDEDILDI"; sefAmirAdi?: string },
) {
  const submission = await prisma.checklistSubmission.update({
    where: { id: input.id },
    data: {
      durum: input.karar,
      onaylayanId: session.user.id,
      onayTarihi: new Date(),
      sefAmirAdi: input.sefAmirAdi ?? session.user.name,
    },
  });
  await auditKaydet(session, "KONTROL_FORMU_KARAR", {
    varlik: "ChecklistSubmission",
    varlikId: input.id,
    detay: { karar: input.karar },
  });
  if (submission.operatorId && submission.operatorId !== session.user.id) {
    await bildirimGonder([submission.operatorId], {
      tip: "ONAY",
      baslik: `Kontrol formu ${input.karar === "ONAYLANDI" ? "onaylandı" : "reddedildi"}`,
      mesaj: `${session.user.name} kararı verdi.`,
      href: `/kontrol-listeleri/${input.id}`,
    });
  }
  return { ok: true, durum: submission.durum };
}
