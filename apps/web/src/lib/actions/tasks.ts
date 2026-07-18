"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import { gorevSuresiSaatTarihli, kmFarki } from "@kars/shared";
import { canAccessTask, loadTaskForAccess, toAccessUser } from "@/lib/access";
import { canTransitionTask, validateKmPair } from "@/lib/domain/task-status";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}
function sayi(v: FormDataEntryValue | null): number | undefined {
  const s = bos(v);
  return s ? Number(s.replace(",", ".")) : undefined;
}
/** "YYYY-MM-DD" + "HH:mm" → Date */
function tarihSaat(t?: string, s?: string): Date | undefined {
  if (!t) return undefined;
  return new Date(`${t}T${s || "00:00"}:00`);
}

/**
 * Görev oluşturma (Excel Görev Formu satırı).
 * Görev No otomatik: GRV-2026-0001. Araç seçilince şoför zimmetten önerilir.
 * Durum "Devam Ediyor" ise araç GOREVDE yapılır (Excel Araç Havuzu durumu).
 */
export async function gorevOlustur(formData: FormData) {
  await requireRoles(["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);

  const vehicleId = String(formData.get("vehicleId"));
  const cikis = tarihSaat(bos(formData.get("cikisTarihi")), bos(formData.get("cikisSaati")));
  const giris = tarihSaat(bos(formData.get("girisTarihi")), bos(formData.get("girisSaati")));
  const kmCikis = sayi(formData.get("kmSayacCikis"));
  const kmGiris = sayi(formData.get("kmSayacGiris"));
  const durum = (bos(formData.get("durum")) ?? "PLANLANDI") as
    | "PLANLANDI"
    | "DEVAM_EDIYOR"
    | "TAMAMLANDI"
    | "IPTAL_EDILDI";

  const kmCheck = validateKmPair(kmCikis, kmGiris);
  if (!kmCheck.ok) throw new Error(kmCheck.error);

  const arac = await prisma.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    include: { atananSofor: true },
  });

  await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, gorevNo } = await nextTaskSerial(tx);

    await tx.vehicleTask.create({
      data: {
        gorevNo,
        yil,
        sira,
        vehicleId,
        talepEdenDepartmentId: bos(formData.get("talepEdenDepartmentId")),
        gorevYeri: bos(formData.get("gorevYeri")),
        gorevTanimi: bos(formData.get("gorevTanimi")),
        cikisTarihi: cikis,
        girisTarihi: giris,
        sureSaat: cikis && giris ? gorevSuresiSaatTarihli(cikis, giris) : undefined,
        driverId: bos(formData.get("driverId")) ?? arac.atananSoforId ?? undefined,
        kmSayacCikis: kmCikis,
        kmSayacGiris: kmGiris,
        kmFarki: kmCikis != null && kmGiris != null ? kmFarki(kmCikis, kmGiris) : undefined,
        onaylayanId: bos(formData.get("onaylayanId")),
        durum,
        not: bos(formData.get("not")),
        maliyet: sayi(formData.get("maliyet")),
      },
    });

    if (durum === "DEVAM_EDIYOR") {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: cikis ?? new Date() },
      });
    }
  });

  revalidatePath("/gorevler");
  revalidatePath("/araclar");
  redirect("/gorevler");
}

/** Görev kapatma: giriş tarih/saat + KM girilir; süre ve KM farkı hesaplanır, araç MUSAIT olur */
export async function gorevKapat(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.tasks);

  const id = String(formData.get("id"));
  const gorev = await loadTaskForAccess(id);
  if (!gorev || !canAccessTask(toAccessUser(session.user), gorev)) {
    throw new Error("Yetkisiz");
  }

  const giris = tarihSaat(
    bos(formData.get("girisTarihi")) ?? new Date().toISOString().slice(0, 10),
    bos(formData.get("girisSaati")),
  );
  const kmGiris = sayi(formData.get("kmSayacGiris"));
  const durum = (bos(formData.get("durum")) ?? "TAMAMLANDI") as "TAMAMLANDI" | "IPTAL_EDILDI";

  const transition = canTransitionTask(gorev.durum, durum);
  if (!transition.ok) throw new Error(transition.error);

  const kmCheck = validateKmPair(gorev.kmSayacCikis, kmGiris);
  if (!kmCheck.ok) throw new Error(kmCheck.error);

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTask.update({
      where: { id },
      data: {
        girisTarihi: giris,
        sureSaat:
          gorev.cikisTarihi && giris
            ? gorevSuresiSaatTarihli(gorev.cikisTarihi, giris)
            : gorev.sureSaat,
        kmSayacGiris: kmGiris ?? gorev.kmSayacGiris,
        kmFarki:
          gorev.kmSayacCikis != null && kmGiris != null
            ? kmFarki(gorev.kmSayacCikis, kmGiris)
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
          sonGirisTarihi: giris ?? new Date(),
          ...(kmGiris != null ? { sayacDeger: kmGiris } : {}),
        },
      });
    }
  });

  revalidatePath("/gorevler");
  revalidatePath("/araclar");
}

/** Görevi başlat: çıkış zamanı yazılır, araç GOREVDE olur */
export async function gorevBaslat(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.tasks);

  const id = String(formData.get("id"));
  const gorev = await loadTaskForAccess(id);
  if (!gorev || !canAccessTask(toAccessUser(session.user), gorev)) {
    throw new Error("Yetkisiz");
  }

  const transition = canTransitionTask(gorev.durum, "DEVAM_EDIYOR");
  if (!transition.ok) throw new Error(transition.error);

  const cikis = new Date();
  const kmCikis = sayi(formData.get("kmSayacCikis"));

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTask.update({
      where: { id },
      data: {
        cikisTarihi: gorev.cikisTarihi ?? cikis,
        kmSayacCikis: kmCikis ?? gorev.kmSayacCikis,
        durum: "DEVAM_EDIYOR",
      },
    });
    await tx.vehicle.update({
      where: { id: gorev.vehicleId },
      data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: cikis },
    });
  });

  revalidatePath("/gorevler");
  revalidatePath("/araclar");
}
