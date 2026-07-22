"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

export async function kontrolFormuOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.checklists);

  const templateId = String(formData.get("templateId"));
  const vehicleId = String(formData.get("vehicleId"));
  const ay = Number(formData.get("ay"));
  const yilDonem = Number(formData.get("yilDonem"));

  const submission = await prisma.checklistSubmission.create({
    data: {
      templateId,
      vehicleId,
      ay,
      yilDonem,
      sorumluOperatorTeknisyen: bos(formData.get("sorumluOperatorTeknisyen")),
      santiyeLokasyon: bos(formData.get("santiyeLokasyon")),
      operatorId: session.user.id,
      durum: "TASLAK",
    },
  });

  revalidatePath("/kontrol-listeleri");
  redirect(`/kontrol-listeleri/${submission.id}`);
}

export async function kontrolKalemKaydet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.checklists);

  const submissionId = String(formData.get("submissionId"));
  const templateItemId = String(formData.get("templateItemId"));
  const periyot = String(formData.get("periyot")) as
    | "HAFTA_1"
    | "HAFTA_2"
    | "HAFTA_3"
    | "HAFTA_4"
    | "AYLIK_BAKIM";
  const sonuc = String(formData.get("sonuc")) as "UYGUN" | "ARIZALI" | "DIKKAT_GEREKLI";
  const aciklamaNot = bos(formData.get("aciklamaNot"));

  await prisma.checklistItemResult.upsert({
    where: {
      submissionId_templateItemId_periyot: { submissionId, templateItemId, periyot },
    },
    create: { submissionId, templateItemId, periyot, sonuc, aciklamaNot },
    update: { sonuc, aciklamaNot },
  });

  // ❌ → otomatik bakım önerisi
  if (sonuc === "ARIZALI") {
    const sub = await prisma.checklistSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        results: {
          where: { templateItemId, periyot },
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

  revalidatePath(`/kontrol-listeleri/${submissionId}`);
  revalidatePath("/bakim");
}

export async function kontrolFormuOnayaGonder(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.checklists);
  const id = String(formData.get("id"));
  await prisma.checklistSubmission.update({
    where: { id },
    data: {
      durum: "ONAY_BEKLIYOR",
      teknisyenAdi: bos(formData.get("teknisyenAdi")),
      sefAmirAdi: bos(formData.get("sefAmirAdi")),
    },
  });

  await auditKaydet(session, "KONTROL_FORMU_ONAYA_GONDER", {
    varlik: "ChecklistSubmission",
    varlikId: id,
  });
  const onaylayanlar = await kullaniciIdleri(["APPROVER"]);
  await bildirimGonder(
    onaylayanlar.filter((uid) => uid !== session.user.id),
    {
      tip: "ONAY",
      baslik: "Kontrol formu onay bekliyor",
      mesaj: `${session.user.name} bir kontrol formunu onaya gönderdi.`,
      href: `/kontrol-listeleri/${id}`,
    },
  );

  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}

export async function kontrolFormuOnayla(formData: FormData) {
  const session = await requireRoles(["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  const id = String(formData.get("id"));
  const karar = String(formData.get("karar")) as "ONAYLANDI" | "REDDEDILDI";
  const submission = await prisma.checklistSubmission.update({
    where: { id },
    data: {
      durum: karar,
      onaylayanId: session.user.id,
      onayTarihi: new Date(),
      sefAmirAdi: bos(formData.get("sefAmirAdi")) ?? session.user.name,
    },
  });

  await auditKaydet(session, "KONTROL_FORMU_KARAR", {
    varlik: "ChecklistSubmission",
    varlikId: id,
    detay: { karar },
  });
  if (submission.operatorId && submission.operatorId !== session.user.id) {
    await bildirimGonder([submission.operatorId], {
      tip: "ONAY",
      baslik: `Kontrol formu ${karar === "ONAYLANDI" ? "onaylandı" : "reddedildi"}`,
      mesaj: `${session.user.name} kararı verdi.`,
      href: `/kontrol-listeleri/${id}`,
    });
  }

  revalidatePath("/kontrol-listeleri");
  revalidatePath(`/kontrol-listeleri/${id}`);
}
