import { z } from "zod";
import { mantiksalAlan, opsiyonelMetin, zorunluMetin } from "@/lib/services/base";

/**
 * Tanımlar ekranının doğrulama şemaları. Yetki ve veritabanı erişiminden
 * bağımsız tutulur; böylece hem servis katmanı hem birim testler Next çalışma
 * zamanına ihtiyaç duymadan kullanabilir.
 */

/** Şifre politikası: en az 8 karakter, en az bir harf ve bir rakam */
export const sifreSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, "Şifre en az bir harf içermeli")
  .regex(/\d/, "Şifre en az bir rakam içermeli");

export const rolSchema = z.enum([
  "ADMIN",
  "CALL_CENTER",
  "DEPARTMENT_MANAGER",
  "FIELD_WORKER",
  "DRIVER",
  "APPROVER",
]);

export const adInputSchema = z.object({ name: zorunluMetin("Ad zorunlu") });

export const mudurlukInputSchema = z.object({
  name: zorunluMetin("Ad zorunlu"),
  shortName: opsiyonelMetin,
  aktif: mantiksalAlan,
});

export const sikayetTuruInputSchema = z.object({
  name: zorunluMetin("Tür adı zorunlu"),
  defaultDepartmentId: opsiyonelMetin,
  aktif: mantiksalAlan,
});

const kullaniciTemel = {
  name: zorunluMetin("Ad zorunlu"),
  phone: z.string().trim().min(10, "Telefon en az 10 hane olmalı"),
  email: opsiyonelMetin,
  role: rolSchema,
  departmentId: opsiyonelMetin,
};

/** Müdürlük yöneticisinin hangi müdürlüğü yönettiği belli olmak zorunda. */
function mudurlukZorunlulugu(
  data: { role: string; departmentId?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.role === "DEPARTMENT_MANAGER" && !data.departmentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DEPARTMENT_MANAGER için müdürlük zorunlu",
      path: ["departmentId"],
    });
  }
}

export const kullaniciOlusturSchema = z
  .object({ ...kullaniciTemel, password: sifreSchema })
  .superRefine(mudurlukZorunlulugu);

export const kullaniciGuncelleSchema = z
  .object({
    ...kullaniciTemel,
    aktif: mantiksalAlan,
    /** Boş bırakılırsa şifre değişmez */
    password: z.union([sifreSchema, z.literal("")]).nullish(),
  })
  .superRefine(mudurlukZorunlulugu);

export const dispatchAyarSchema = z.object({ otomatikAtama: mantiksalAlan });
