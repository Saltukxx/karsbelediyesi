"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@kars/db";
import bcrypt from "bcryptjs";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { ALL_MODULE_HREFS, deptModulesSettingKey } from "@/lib/dept-modules";
import {
  mahalleOlusturForUser,
  mudurlukOlusturForUser,
  sikayetTuruOlusturForUser,
} from "@/lib/domain/crud-for-user";

/** Şifre politikası: en az 8 karakter, en az bir harf ve bir rakam */
const sifreSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, "Şifre en az bir harf içermeli")
  .regex(/\d/, "Şifre en az bir rakam içermeli");

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

const rolSchema = z.enum([
  "ADMIN",
  "CALL_CENTER",
  "DEPARTMENT_MANAGER",
  "FIELD_WORKER",
  "DRIVER",
  "APPROVER",
]);

const userCreateSchema = z
  .object({
    name: z.string().min(1),
    phone: z.string().min(10),
    email: z.string().optional(),
    password: sifreSchema,
    role: rolSchema,
    departmentId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "DEPARTMENT_MANAGER" && !data.departmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DEPARTMENT_MANAGER için müdürlük zorunlu",
        path: ["departmentId"],
      });
    }
  });

export async function mahalleOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  await mahalleOlusturForUser(session.user, { name: String(formData.get("name")).trim() });
  revalidatePath("/tanimlar");
}

export async function mahalleGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  const name = String(formData.get("name")).trim();
  if (!name) throw new Error("Mahalle adı gerekli");

  await prisma.neighborhood.update({
    where: { id },
    data: {
      name,
      aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
    },
  });
  await auditKaydet(session, "MAHALLE_GUNCELLE", {
    varlik: "Neighborhood",
    varlikId: id,
    detay: { name },
  });
  revalidatePath("/tanimlar");
}

export async function mudurlukOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const name = String(formData.get("name")).trim();
  await mudurlukOlusturForUser(session.user, {
    name,
    shortName: bos(formData.get("shortName")),
  });
  revalidatePath("/tanimlar");
}

export async function mudurlukGuncelle(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id"));
  await prisma.department.update({
    where: { id },
    data: {
      name: String(formData.get("name")).trim(),
      shortName: bos(formData.get("shortName")),
      aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
    },
  });
  revalidatePath("/tanimlar");
}

/** Müdürlük → görünür menü href'leri (AppSetting JSON) */
export async function mudurlukModulleriKaydet(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  if (!departmentId) throw new Error("Müdürlük seçilmedi");

  const allowed = new Set(ALL_MODULE_HREFS);
  const hrefs = formData
    .getAll("modules")
    .map(String)
    .filter((h) => allowed.has(h));
  if (!hrefs.includes("/")) hrefs.unshift("/");

  await prisma.appSetting.upsert({
    where: { key: deptModulesSettingKey(departmentId) },
    create: {
      key: deptModulesSettingKey(departmentId),
      value: JSON.stringify(hrefs),
    },
    update: { value: JSON.stringify(hrefs) },
  });

  revalidatePath("/tanimlar");
  revalidatePath("/", "layout");
}

export async function sikayetTuruOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  await sikayetTuruOlusturForUser(session.user, {
    name: String(formData.get("name")).trim(),
    defaultDepartmentId: bos(formData.get("defaultDepartmentId")),
  });
  revalidatePath("/tanimlar");
}

export async function sikayetTuruGuncelle(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id"));
  await prisma.complaintType.update({
    where: { id },
    data: {
      name: String(formData.get("name")).trim(),
      defaultDepartmentId: bos(formData.get("defaultDepartmentId")) ?? null,
      aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
    },
  });
  revalidatePath("/tanimlar");
}

export async function aracCinsiOlustur(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  await prisma.vehicleType.create({
    data: { name: String(formData.get("name")).trim() },
  });
  revalidatePath("/tanimlar");
}

export async function aracCinsiGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Kayıt bulunamadı");
  const name = String(formData.get("name")).trim();
  if (!name) throw new Error("Araç cinsi adı gerekli");

  await prisma.vehicleType.update({
    where: { id },
    data: {
      name,
      aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
    },
  });
  await auditKaydet(session, "ARAC_CINSI_GUNCELLE", {
    varlik: "VehicleType",
    varlikId: id,
    detay: { name },
  });
  revalidatePath("/tanimlar");
}

export async function kullaniciOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const parsed = userCreateSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: bos(formData.get("email")),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    departmentId: bos(formData.get("departmentId")),
  });
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const created = await prisma.user.create({
    data: {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      departmentId: parsed.departmentId,
    },
  });
  await auditKaydet(session, "KULLANICI_OLUSTUR", {
    varlik: "User",
    varlikId: created.id,
    detay: { ad: parsed.name, rol: parsed.role },
  });
  revalidatePath("/tanimlar");
}

export async function kullaniciGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id"));
  const password = bos(formData.get("password"));
  if (password) sifreSchema.parse(password);
  const role = rolSchema.parse(String(formData.get("role") ?? ""));
  const departmentId = bos(formData.get("departmentId")) ?? null;
  if (role === "DEPARTMENT_MANAGER" && !departmentId) {
    throw new Error("DEPARTMENT_MANAGER için müdürlük zorunlu");
  }
  await prisma.user.update({
    where: { id },
    data: {
      name: String(formData.get("name")).trim(),
      phone: String(formData.get("phone")).trim(),
      email: bos(formData.get("email")) ?? null,
      role,
      departmentId,
      aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  await auditKaydet(session, "KULLANICI_GUNCELLE", {
    varlik: "User",
    varlikId: id,
    detay: { rol: role, sifreDegisti: Boolean(password) },
  });
  revalidatePath("/tanimlar");
}
