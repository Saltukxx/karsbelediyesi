import { prisma } from "@kars/db";
import type { KontrolPeriyot, KontrolSonuc } from "@kars/db";
import { ACTION_ROLES, assertRole, type SessionUser } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

const PERIYOTLAR: KontrolPeriyot[] = [
  "HAFTA_1",
  "HAFTA_2",
  "HAFTA_3",
  "HAFTA_4",
  "AYLIK_BAKIM",
];
const SONUCLAR: KontrolSonuc[] = ["UYGUN", "ARIZALI", "DIKKAT_GEREKLI"];

export async function kontrolFormuOlusturForUser(
  user: SessionUser,
  input: {
    templateId: string;
    vehicleId: string;
    ay: number;
    yilDonem: number;
    sorumluOperatorTeknisyen?: string;
    santiyeLokasyon?: string;
  },
) {
  assertRole(user, ACTION_ROLES.checklists);
  if (!input.templateId || !input.vehicleId) throw new Error("Şablon ve araç zorunlu");
  if (!input.ay || !input.yilDonem) throw new Error("Ay ve yıl zorunlu");

  const submission = await prisma.checklistSubmission.upsert({
    where: {
      templateId_vehicleId_ay_yilDonem: {
        templateId: input.templateId,
        vehicleId: input.vehicleId,
        ay: input.ay,
        yilDonem: input.yilDonem,
      },
    },
    create: {
      templateId: input.templateId,
      vehicleId: input.vehicleId,
      ay: input.ay,
      yilDonem: input.yilDonem,
      sorumluOperatorTeknisyen: input.sorumluOperatorTeknisyen,
      santiyeLokasyon: input.santiyeLokasyon,
      operatorId: user.id,
      durum: "TASLAK",
    },
    update: {
      sorumluOperatorTeknisyen: input.sorumluOperatorTeknisyen,
      santiyeLokasyon: input.santiyeLokasyon,
    },
  });
  return submission;
}

export async function kontrolKalemKaydetForUser(
  user: SessionUser,
  input: {
    submissionId: string;
    templateItemId: string;
    periyot: KontrolPeriyot;
    sonuc: KontrolSonuc;
    aciklamaNot?: string;
  },
) {
  assertRole(user, ACTION_ROLES.checklists);
  if (!PERIYOTLAR.includes(input.periyot)) throw new Error("Geçersiz periyot");
  if (!SONUCLAR.includes(input.sonuc)) throw new Error("Geçersiz sonuç");

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

  if (input.sonuc === "ARIZALI") {
    const sub = await prisma.checklistSubmission.findUniqueOrThrow({
      where: { id: input.submissionId },
      include: {
        results: {
          where: { templateItemId: input.templateItemId, periyot: input.periyot },
          include: { templateItem: true },
        },
      },
    });
    const result = sub.results[0];
    if (result) {
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
    }
  }
  return { ok: true };
}

export async function kontrolFormuOnayaGonderForUser(
  user: SessionUser,
  input: { id: string; teknisyenAdi?: string; sefAmirAdi?: string },
) {
  assertRole(user, ACTION_ROLES.checklists);
  await prisma.checklistSubmission.update({
    where: { id: input.id },
    data: {
      durum: "ONAY_BEKLIYOR",
      teknisyenAdi: input.teknisyenAdi,
      sefAmirAdi: input.sefAmirAdi,
    },
  });
  await auditKaydet({ user }, "KONTROL_FORMU_ONAYA_GONDER", {
    varlik: "ChecklistSubmission",
    varlikId: input.id,
  });
  const onaylayanlar = await kullaniciIdleri(["APPROVER"]);
  await bildirimGonder(
    onaylayanlar.filter((uid) => uid !== user.id),
    {
      tip: "ONAY",
      baslik: "Kontrol formu onay bekliyor",
      mesaj: `${user.name} bir kontrol formunu onaya gönderdi.`,
      href: `/kontrol-listeleri/${input.id}`,
    },
  );
  return { ok: true };
}

export async function kontrolFormuOnaylaForUser(
  user: SessionUser,
  input: { id: string; karar: "ONAYLANDI" | "REDDEDILDI"; sefAmirAdi?: string },
) {
  assertRole(user, ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  if (input.karar !== "ONAYLANDI" && input.karar !== "REDDEDILDI") {
    throw new Error("Geçersiz karar");
  }
  const submission = await prisma.checklistSubmission.update({
    where: { id: input.id },
    data: {
      durum: input.karar,
      onaylayanId: user.id,
      onayTarihi: new Date(),
      sefAmirAdi: input.sefAmirAdi ?? user.name,
    },
  });
  await auditKaydet({ user }, "KONTROL_FORMU_KARAR", {
    varlik: "ChecklistSubmission",
    varlikId: input.id,
    detay: { karar: input.karar },
  });
  if (submission.operatorId && submission.operatorId !== user.id) {
    await bildirimGonder([submission.operatorId], {
      tip: "ONAY",
      baslik: `Kontrol formu ${input.karar === "ONAYLANDI" ? "onaylandı" : "reddedildi"}`,
      mesaj: `${user.name} kararı verdi.`,
      href: `/kontrol-listeleri/${input.id}`,
    });
  }
  return { ok: true };
}
