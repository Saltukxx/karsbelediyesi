"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@kars/db";
import bcrypt from "bcryptjs";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

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
    password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
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
  await requireRoles(ACTION_ROLES.definitions);
  const name = String(formData.get("name")).trim();
  await prisma.neighborhood.create({ data: { name } });
  revalidatePath("/tanimlar");
}

export async function mudurlukOlustur(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const name = String(formData.get("name")).trim();
  const shortName = bos(formData.get("shortName")) ?? name.slice(0, 20);
  await prisma.department.create({
    data: { name, shortName },
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

export async function sikayetTuruOlustur(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  await prisma.complaintType.create({
    data: {
      name: String(formData.get("name")).trim(),
      defaultDepartmentId: bos(formData.get("defaultDepartmentId")),
    },
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

export async function kullaniciOlustur(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const parsed = userCreateSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: bos(formData.get("email")),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    departmentId: bos(formData.get("departmentId")),
  });
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      departmentId: parsed.departmentId,
    },
  });
  revalidatePath("/tanimlar");
}

export async function kullaniciGuncelle(formData: FormData) {
  await requireRoles(ACTION_ROLES.definitions);
  const id = String(formData.get("id"));
  const password = bos(formData.get("password"));
  if (password && password.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalı");
  }
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
  revalidatePath("/tanimlar");
}
