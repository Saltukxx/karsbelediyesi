import { z } from "zod";
import { prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { canTransitionAsfalt } from "@/lib/domain/asfalt-status";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  opsiyonelMetin as bosBoslukTemiz,
  ServiceError,
  type ServiceActor,
} from "@/lib/services/base";

/**
 * "İşlerim": saha personelinin yalnızca kendisine atanmış işleri.
 *
 * Yetki rol listesiyle değil **atama** ile belirlenir; bu yüzden servisler
 * `rolGerekli` çağırmaz, her işlemde atamanın varlığını doğrular. Web
 * `/islerim` sayfası ile aynı davranış.
 */

/** Oturumdaki kullanıcının personel kaydı; yoksa null (şoför olabilir). */
async function oturumPersoneli(userId: string) {
  return prisma.personnel.findFirst({
    where: { userId },
    select: { id: true, adSoyad: true, department: { select: { name: true } } },
  });
}

/** Yazma işlemleri personel kaydı olmadan yapılamaz. */
async function personelZorunlu(userId: string) {
  const personel = await oturumPersoneli(userId);
  if (!personel) {
    throw new ServiceError("Hesabınıza bağlı personel kaydı bulunamadı", 403);
  }
  return personel;
}

export async function islerimOzeti(actor: ServiceActor) {
  const [personel, aracGorevleri] = await Promise.all([
    oturumPersoneli(actor.user.id),
    // Şoför olarak üzerine atanan araç görevleri (personel kaydı olmasa da görünür)
    prisma.vehicleTask.findMany({
      where: { driverId: actor.user.id },
      orderBy: [{ durum: "asc" }, { talepTarihi: "desc" }],
      take: 20,
      select: {
        id: true,
        gorevNo: true,
        durum: true,
        gorevYeri: true,
        gorevTanimi: true,
        cikisTarihi: true,
        girisTarihi: true,
        dispatchJobId: true,
        vehicle: { select: { plaka: true } },
      },
    }),
  ]);

  const [sikayetAtamalari, rotaAtamalari] = personel
    ? await Promise.all([
        prisma.complaintPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            complaint: {
              include: {
                complaintType: { select: { id: true, name: true } },
                neighborhood: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.asphaltRoadPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            asphaltRoad: {
              include: { department: { select: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const sikayetler = sikayetAtamalari
    .map((a) => a.complaint)
    .sort((a, b) => b.kayitTarihi.getTime() - a.kayitTarihi.getTime());

  return {
    personel: personel
      ? {
          id: personel.id,
          adSoyad: personel.adSoyad,
          mudurluk: personel.department?.name ?? null,
        }
      : null,
    aracGorevleri: aracGorevleri.map((g) => ({
      id: g.id,
      gorevNo: g.gorevNo,
      durum: g.durum,
      plaka: g.vehicle.plaka,
      gorevYeri: g.gorevYeri,
      gorevTanimi: g.gorevTanimi,
      cikisTarihi: g.cikisTarihi?.toISOString() ?? null,
      girisTarihi: g.girisTarihi?.toISOString() ?? null,
      takipVar: g.dispatchJobId != null,
    })),
    sikayetler: sikayetler.map((s) => ({
      id: s.id,
      sikayetNo: s.sikayetNo,
      kanal: s.kanal,
      durum: s.durum,
      oncelik: s.oncelik,
      kayitTarihi: s.kayitTarihi.toISOString(),
      arayanKisi: s.arayanKisi,
      telefon: s.telefon,
      acikAdres: s.acikAdres,
      aciklama: s.aciklama,
      tur: s.complaintType?.name ?? null,
      mahalle: s.neighborhood?.name ?? null,
      mudurluk: s.department?.name ?? null,
    })),
    rotalar: rotaAtamalari.map((a) => ({
      id: a.asphaltRoad.id,
      ad: a.asphaltRoad.ad,
      durum: a.asphaltRoad.durum,
      mudurluk: a.asphaltRoad.department?.name ?? null,
      dokumTarihi: a.asphaltRoad.dokumTarihi?.toISOString() ?? null,
      notlar: a.asphaltRoad.notlar,
    })),
  };
}

export async function islerimSikayetDetay(actor: ServiceActor, id: string) {
  const personel = await personelZorunlu(actor.user.id);

  const atama = await prisma.complaintPersonnel.findUnique({
    where: { complaintId_personnelId: { complaintId: id, personnelId: personel.id } },
  });
  if (!atama) throw new ServiceError("Bu şikayet size atanmamış", 403);

  const s = await prisma.complaint.findUnique({
    where: { id },
    include: {
      neighborhood: { select: { id: true, name: true } },
      complaintType: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      photos: { select: { id: true, url: true, tip: true } },
    },
  });
  if (!s) throw new ServiceError("Şikayet bulunamadı", 404);

  // Konuşma geçmişi: şikayete bağlı mesajlar + aynı telefonun mesajları
  const mesajlar = await prisma.whatsAppMessage.findMany({
    where: {
      OR: [
        { complaintId: s.id },
        ...(s.telefon ? [{ telefon: s.telefon.replace(/\D/g, "") }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { sentByUser: { select: { name: true } } },
  });

  return {
    id: s.id,
    sikayetNo: s.sikayetNo,
    kanal: s.kanal,
    durum: s.durum,
    oncelik: s.oncelik,
    kayitTarihi: s.kayitTarihi.toISOString(),
    arayanKisi: s.arayanKisi,
    telefon: s.telefon,
    acikAdres: s.acikAdres,
    aciklama: s.aciklama,
    tur: s.complaintType?.name ?? null,
    mahalle: s.neighborhood?.name ?? null,
    mudurluk: s.department?.name ?? null,
    cozumNotu: s.cozumNotu,
    kapanisTarihi: s.kapanisTarihi?.toISOString() ?? null,
    fotograflar: s.photos.map((f) => ({ id: f.id, url: f.url, tip: f.tip })),
    mesajlar: mesajlar.map((m) => ({
      id: m.id,
      yon: m.yon,
      icerik: m.icerik,
      medyaUrl: m.medyaUrl,
      medyaTipi: m.medyaTipi,
      gonderimDurumu: m.gonderimDurumu,
      gonderen: m.sentByUser?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export const islerimSikayetDurumInputSchema = z.object({
  durum: z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]),
  cozumNotu: bosBoslukTemiz,
});

/** Kendisine atanan şikayetin durumunu günceller (saha personeli) */
export async function islerimSikayetDurum(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  const personel = await personelZorunlu(actor.user.id);
  const { durum, cozumNotu } = islerimSikayetDurumInputSchema.parse(input);

  const atama = await prisma.complaintPersonnel.findUnique({
    where: { complaintId_personnelId: { complaintId: id, personnelId: personel.id } },
    include: { complaint: true },
  });
  if (!atama) throw new ServiceError("Bu şikayet size atanmamış", 403);

  const eski = atama.complaint;
  const gecis = canTransitionComplaint(eski.durum, durum, actor.user.role);
  if (!gecis.ok) throw new ServiceError(gecis.error, 409);

  const guncel = await prisma.complaint.update({
    where: { id },
    data: {
      durum,
      ...(durum === "KAPATILDI"
        ? { kapanisTarihi: new Date(), cozumNotu, onaylayanId: actor.user.id }
        : {}),
      events: {
        create: {
          userId: actor.user.id,
          tip: "DURUM_DEGISTI",
          detay: { eski: eski.durum, yeni: durum, cozumNotu, kaynak: "islerim" },
        },
      },
    },
  });

  await auditKaydet(actor, "ISLERIM_SIKAYET_DURUM", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: eski.sikayetNo, eski: eski.durum, yeni: durum },
  });

  if (eski.departmentId && durum !== eski.durum) {
    const yoneticiler = await kullaniciIdleri(
      ["DEPARTMENT_MANAGER"],
      eski.departmentId,
    );
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== actor.user.id),
      {
        tip: "GOREV",
        baslik: `${eski.sikayetNo} durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${eski.durum} → ${durum}`,
        href: `/sikayetler/${id}`,
      },
    );
  }

  return guncel;
}

export const islerimAsfaltDurumInputSchema = z.object({
  durum: z.enum(["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI"]),
});

/** Kendisine atanan asfalt rotasının durumunu günceller (saha personeli) */
export async function islerimAsfaltDurum(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  const personel = await personelZorunlu(actor.user.id);
  const { durum } = islerimAsfaltDurumInputSchema.parse(input);

  const atama = await prisma.asphaltRoadPersonnel.findUnique({
    where: { asphaltRoadId_personnelId: { asphaltRoadId: id, personnelId: personel.id } },
    include: {
      asphaltRoad: { select: { ad: true, departmentId: true, durum: true } },
    },
  });
  if (!atama) throw new ServiceError("Bu rota size atanmamış", 403);

  const gecis = canTransitionAsfalt(atama.asphaltRoad.durum, durum, actor.user.role);
  if (!gecis.ok) throw new ServiceError(gecis.error, 409);

  const guncel = await prisma.asphaltRoad.update({ where: { id }, data: { durum } });

  await auditKaydet(actor, "ISLERIM_ASFALT_DURUM", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: atama.asphaltRoad.ad, eski: atama.asphaltRoad.durum, yeni: durum },
  });

  if (atama.asphaltRoad.departmentId && durum !== atama.asphaltRoad.durum) {
    const yoneticiler = await kullaniciIdleri(
      ["DEPARTMENT_MANAGER"],
      atama.asphaltRoad.departmentId,
    );
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== actor.user.id),
      {
        tip: "GOREV",
        baslik: `"${atama.asphaltRoad.ad}" rota durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${atama.asphaltRoad.durum} → ${durum}`,
        href: "/harita",
      },
    );
  }

  return guncel;
}
