import { z } from "zod";
import { KontrolPeriyot, KontrolSonuc, prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  bulunamadi,
  opsiyonelMetin,
  rolGerekli,
  sayiAlani,
  ServiceError,
  type ServiceActor,
} from "@/lib/services/base";

export const PERIYOTLAR = [
  "HAFTA_1",
  "HAFTA_2",
  "HAFTA_3",
  "HAFTA_4",
  "AYLIK_BAKIM",
] as const;

export const kontrolFormuInputSchema = z.object({
  templateId: z.string().trim().min(1, "Şablon zorunlu"),
  vehicleId: z.string().trim().min(1, "Araç zorunlu"),
  ay: sayiAlani(z.number().int().min(1).max(12)),
  yilDonem: sayiAlani(z.number().int().min(2000).max(2100)),
  sorumluOperatorTeknisyen: opsiyonelMetin,
  santiyeLokasyon: opsiyonelMetin,
});

export type KontrolFormuInput = z.input<typeof kontrolFormuInputSchema>;

/** Yeni kontrol formu taslağı (Excel "Periyodik Kontrol Formu" başlığı). */
export async function kontrolFormuOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.checklists);
  const data = kontrolFormuInputSchema.parse(input);

  const submission = await prisma.checklistSubmission.create({
    data: {
      templateId: data.templateId,
      vehicleId: data.vehicleId,
      ay: data.ay,
      yilDonem: data.yilDonem,
      sorumluOperatorTeknisyen: data.sorumluOperatorTeknisyen,
      santiyeLokasyon: data.santiyeLokasyon,
      operatorId: actor.user.id,
      durum: "TASLAK",
    },
  });

  await auditKaydet(actor, "KONTROL_FORMU_OLUSTUR", {
    varlik: "ChecklistSubmission",
    varlikId: submission.id,
    detay: { ay: data.ay, yilDonem: data.yilDonem },
  });

  return submission;
}

export const kontrolKalemInputSchema = z.object({
  templateItemId: z.string().trim().min(1, "Kontrol kalemi zorunlu"),
  periyot: z.nativeEnum(KontrolPeriyot),
  sonuc: z.nativeEnum(KontrolSonuc),
  aciklamaNot: opsiyonelMetin,
});

export type KontrolKalemInput = z.input<typeof kontrolKalemInputSchema>;

/**
 * Tek kontrol kalemini kaydeder. ARIZALI sonucu, aynı kalem için henüz kayıt
 * yoksa otomatik bir "ARIZA_ONARIMI" bakım kaydı açar (Excel'in kırmızı
 * işaretlenen satırının iş emrine dönmesi davranışı).
 */
export async function kontrolKalemKaydet(
  actor: ServiceActor,
  submissionId: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.checklists);
  const data = kontrolKalemInputSchema.parse(input);

  const submission = await prisma.checklistSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, vehicleId: true, durum: true },
  });
  if (!submission) bulunamadi("Kontrol formu");
  if (submission.durum === "ONAYLANDI" || submission.durum === "REDDEDILDI") {
    throw new ServiceError("Karara bağlanmış form değiştirilemez", 409);
  }

  const result = await prisma.checklistItemResult.upsert({
    where: {
      submissionId_templateItemId_periyot: {
        submissionId,
        templateItemId: data.templateItemId,
        periyot: data.periyot,
      },
    },
    create: {
      submissionId,
      templateItemId: data.templateItemId,
      periyot: data.periyot,
      sonuc: data.sonuc,
      aciklamaNot: data.aciklamaNot,
    },
    update: { sonuc: data.sonuc, aciklamaNot: data.aciklamaNot },
    include: { templateItem: { select: { kontrolKalemi: true } } },
  });

  let bakimKaydiId: string | null = null;
  if (data.sonuc === "ARIZALI") {
    const mevcut = await prisma.maintenanceRecord.findUnique({
      where: { kaynakChecklistItemResultId: result.id },
      select: { id: true },
    });
    if (mevcut) {
      bakimKaydiId = mevcut.id;
    } else {
      const bakim = await prisma.maintenanceRecord.create({
        data: {
          vehicleId: submission.vehicleId,
          bakimTarihi: new Date(),
          bakimTuru: "ARIZA_ONARIMI",
          yapilanIslemler: `Kontrol formu: ${result.templateItem.kontrolKalemi}`,
          durum: "PLANLANDI",
          kaynakChecklistItemResultId: result.id,
        },
      });
      bakimKaydiId = bakim.id;
    }
  }

  return {
    id: result.id,
    templateItemId: result.templateItemId,
    periyot: result.periyot,
    sonuc: result.sonuc,
    aciklamaNot: result.aciklamaNot,
    bakimKaydiId,
  };
}

export const kontrolOnayaGonderInputSchema = z.object({
  teknisyenAdi: opsiyonelMetin,
  sefAmirAdi: opsiyonelMetin,
});

export type KontrolOnayaGonderInput = z.input<typeof kontrolOnayaGonderInputSchema>;

export async function kontrolFormuOnayaGonder(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.checklists);
  const data = kontrolOnayaGonderInputSchema.parse(input);

  const mevcut = await prisma.checklistSubmission.findUnique({
    where: { id },
    select: { id: true, durum: true },
  });
  if (!mevcut) bulunamadi("Kontrol formu");
  if (mevcut.durum !== "TASLAK") {
    throw new ServiceError("Yalnızca taslak formlar onaya gönderilebilir", 409);
  }

  const submission = await prisma.checklistSubmission.update({
    where: { id },
    data: {
      durum: "ONAY_BEKLIYOR",
      teknisyenAdi: data.teknisyenAdi,
      sefAmirAdi: data.sefAmirAdi,
    },
  });

  await auditKaydet(actor, "KONTROL_FORMU_ONAYA_GONDER", {
    varlik: "ChecklistSubmission",
    varlikId: id,
  });

  const onaylayanlar = await kullaniciIdleri(["APPROVER"]);
  await bildirimGonder(
    onaylayanlar.filter((uid) => uid !== actor.user.id),
    {
      tip: "ONAY",
      baslik: "Kontrol formu onay bekliyor",
      mesaj: `${actor.user.name} bir kontrol formunu onaya gönderdi.`,
      href: `/kontrol-listeleri/${id}`,
    },
  );

  return submission;
}

export const kontrolOnaylaInputSchema = z.object({
  karar: z.enum(["ONAYLANDI", "REDDEDILDI"]),
  sefAmirAdi: opsiyonelMetin,
});

export type KontrolOnaylaInput = z.input<typeof kontrolOnaylaInputSchema>;

export async function kontrolFormuOnayla(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  const data = kontrolOnaylaInputSchema.parse(input);

  const mevcut = await prisma.checklistSubmission.findUnique({
    where: { id },
    select: { id: true, durum: true },
  });
  if (!mevcut) bulunamadi("Kontrol formu");
  if (mevcut.durum !== "ONAY_BEKLIYOR") {
    throw new ServiceError("Form onay bekleyen durumda değil", 409);
  }

  const submission = await prisma.checklistSubmission.update({
    where: { id },
    data: {
      durum: data.karar,
      onaylayanId: actor.user.id,
      onayTarihi: new Date(),
      sefAmirAdi: data.sefAmirAdi ?? actor.user.name,
    },
  });

  await auditKaydet(actor, "KONTROL_FORMU_KARAR", {
    varlik: "ChecklistSubmission",
    varlikId: id,
    detay: { karar: data.karar },
  });

  if (submission.operatorId && submission.operatorId !== actor.user.id) {
    await bildirimGonder([submission.operatorId], {
      tip: "ONAY",
      baslik: `Kontrol formu ${data.karar === "ONAYLANDI" ? "onaylandı" : "reddedildi"}`,
      mesaj: `${actor.user.name} kararı verdi.`,
      href: `/kontrol-listeleri/${id}`,
    });
  }

  return submission;
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/** Liste ekranının ihtiyacı: doldurulmuş formlar + seçilebilir şablonlar/araçlar. */
export async function kontrolListesi(actor: ServiceActor) {
  rolGerekli(actor, ACTION_ROLES.checklists);

  const [formlar, sablonlar, araclar] = await Promise.all([
    prisma.checklistSubmission.findMany({
      include: {
        template: { select: { id: true, ekipmanAdi: true } },
        vehicle: { select: { id: true, plaka: true } },
        operator: { select: { name: true } },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.checklistTemplate.findMany({
      where: { aktif: true },
      select: {
        id: true,
        ekipmanAdi: true,
        aciklama: true,
        _count: { select: { items: true } },
      },
      orderBy: { ekipmanAdi: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" } },
      select: { id: true, plaka: true, ad: true },
      orderBy: { plaka: "asc" },
    }),
  ]);

  return {
    formlar: formlar.map((f) => ({
      id: f.id,
      sablonId: f.template.id,
      sablonAdi: f.template.ekipmanAdi,
      plaka: f.vehicle.plaka,
      ay: f.ay,
      yilDonem: f.yilDonem,
      durum: f.durum,
      operatorAdi: f.operator?.name ?? f.sorumluOperatorTeknisyen,
      santiyeLokasyon: f.santiyeLokasyon,
      doldurulanKalem: f._count.results,
      onayTarihi: f.onayTarihi?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
    })),
    sablonlar: sablonlar.map((s) => ({
      id: s.id,
      ekipmanAdi: s.ekipmanAdi,
      aciklama: s.aciklama,
      kalemSayisi: s._count.items,
    })),
    araclar: araclar.map((a) => ({
      id: a.id,
      plaka: a.plaka,
      etiket: a.ad ? `${a.plaka} — ${a.ad}` : a.plaka,
    })),
    periyotlar: PERIYOTLAR,
  };
}

/** Detay ekranı: kalem × periyot matrisi, kategori kırılımıyla. */
export async function kontrolFormuDetay(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.checklists);

  const submission = await prisma.checklistSubmission.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          items: { where: { aktif: true }, orderBy: { siraNo: "asc" } },
        },
      },
      vehicle: { select: { id: true, plaka: true, ad: true } },
      results: true,
      onaylayan: { select: { name: true } },
      operator: { select: { name: true } },
    },
  });
  if (!submission) bulunamadi("Kontrol formu");

  const sonuclar = new Map(
    submission.results.map((r) => [`${r.templateItemId}:${r.periyot}`, r]),
  );

  const kategoriler: {
    kategori: string;
    kalemler: {
      id: string;
      siraNo: number;
      kontrolKalemi: string;
      sonuclar: Record<string, { sonuc: string; aciklamaNot: string | null } | null>;
    }[];
  }[] = [];

  for (const item of submission.template.items) {
    let grup = kategoriler.find((k) => k.kategori === item.kategori);
    if (!grup) {
      grup = { kategori: item.kategori, kalemler: [] };
      kategoriler.push(grup);
    }
    const periyotSonuclari: Record<
      string,
      { sonuc: string; aciklamaNot: string | null } | null
    > = {};
    for (const periyot of PERIYOTLAR) {
      const r = sonuclar.get(`${item.id}:${periyot}`);
      periyotSonuclari[periyot] = r
        ? { sonuc: r.sonuc, aciklamaNot: r.aciklamaNot }
        : null;
    }
    grup.kalemler.push({
      id: item.id,
      siraNo: item.siraNo,
      kontrolKalemi: item.kontrolKalemi,
      sonuclar: periyotSonuclari,
    });
  }

  return {
    id: submission.id,
    sablonAdi: submission.template.ekipmanAdi,
    plaka: submission.vehicle.plaka,
    aracAdi: submission.vehicle.ad,
    ay: submission.ay,
    yilDonem: submission.yilDonem,
    durum: submission.durum,
    // Web ile aynı kural: taslak ve onay bekleyen formlar düzenlenebilir
    duzenlenebilir:
      submission.durum === "TASLAK" || submission.durum === "ONAY_BEKLIYOR",
    sorumluOperatorTeknisyen: submission.sorumluOperatorTeknisyen,
    santiyeLokasyon: submission.santiyeLokasyon,
    operatorAdi: submission.operator?.name ?? null,
    teknisyenAdi: submission.teknisyenAdi,
    sefAmirAdi: submission.sefAmirAdi,
    onaylayanAdi: submission.onaylayan?.name ?? null,
    onayTarihi: submission.onayTarihi?.toISOString() ?? null,
    createdAt: submission.createdAt.toISOString(),
    periyotlar: PERIYOTLAR,
    kategoriler,
    arizaliSayisi: submission.results.filter((r) => r.sonuc === "ARIZALI").length,
    dikkatSayisi: submission.results.filter((r) => r.sonuc === "DIKKAT_GEREKLI").length,
  };
}
