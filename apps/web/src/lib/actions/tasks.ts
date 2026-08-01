"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import * as gorevServis from "@/lib/services/tasks";

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

export async function gorevOlustur(formData: FormData) {
  const session = await requireSession();
  await gorevServis.gorevOlustur(session, {
    vehicleId: String(formData.get("vehicleId") ?? ""),
    talepEdenDepartmentId: bos(formData.get("talepEdenDepartmentId")),
    driverId: bos(formData.get("driverId")),
    gorevYeri: bos(formData.get("gorevYeri")),
    gorevTanimi: bos(formData.get("gorevTanimi")),
    cikisTarihi: tarihSaat(bos(formData.get("cikisTarihi")), bos(formData.get("cikisSaati"))),
    girisTarihi: tarihSaat(bos(formData.get("girisTarihi")), bos(formData.get("girisSaati"))),
    kmSayacCikis: sayi(formData.get("kmSayacCikis")),
    kmSayacGiris: sayi(formData.get("kmSayacGiris")),
    onaylayanId: bos(formData.get("onaylayanId")),
    durum: bos(formData.get("durum")) as never,
    not: bos(formData.get("not")),
    maliyet: sayi(formData.get("maliyet")),
  });
  revalidatePath("/gorevler");
  revalidatePath("/araclar");
  redirect("/gorevler");
}

export async function gorevKapat(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  await gorevServis.gorevKapat(session, id, {
    girisTarihi: tarihSaat(
      bos(formData.get("girisTarihi")) ?? new Date().toISOString().slice(0, 10),
      bos(formData.get("girisSaati")),
    ),
    kmSayacGiris: sayi(formData.get("kmSayacGiris")),
    durum: bos(formData.get("durum")) as never,
  });
  revalidatePath("/gorevler");
  revalidatePath("/araclar");
}

export async function gorevBaslat(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  await gorevServis.gorevBaslat(session, id, {
    kmSayacCikis: sayi(formData.get("kmSayacCikis")),
  });
  revalidatePath("/gorevler");
  revalidatePath("/araclar");
}
