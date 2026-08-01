import bcrypt from "bcryptjs";
import { isUniqueViolation, prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import { otomatikAtamaAcikMi, otomatikAtamaAyarla } from "@/lib/dispatch";
import {
  alanGonderildi,
  bulunamadi,
  rolGerekli,
  ServiceError,
  type ServiceActor,
} from "@/lib/services/base";
import {
  adInputSchema,
  dispatchAyarSchema,
  kullaniciGuncelleSchema,
  kullaniciOlusturSchema,
  mudurlukInputSchema,
  sikayetTuruInputSchema,
} from "@/lib/services/definitions-schema";

// MARK: - Okuma

export interface TanimOgesiDTO {
  id: string;
  name: string;
  aktif: boolean;
}

export interface MudurlukDTO extends TanimOgesiDTO {
  shortName: string;
}

export interface SikayetTuruDTO extends TanimOgesiDTO {
  defaultDepartmentId: string | null;
}

export interface PanelKullaniciDTO {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  departmentId: string | null;
  aktif: boolean;
  lastLoginAt: Date | null;
}

export interface TanimlarDTO {
  mahalleler: TanimOgesiDTO[];
  mudurlukler: MudurlukDTO[];
  sikayetTurleri: SikayetTuruDTO[];
  aracCinsleri: TanimOgesiDTO[];
  kullanicilar: PanelKullaniciDTO[];
  otomatikAtama: boolean;
}

/**
 * Yönetim ekranının tüm veri kümesi. Web sayfası gibi pasif kayıtları da
 * döndürür; form açılır listeleri için `/api/v1/lookups` kullanılır (o yalnızca
 * aktifleri verir).
 */
export async function tanimlarVerisi(actor: ServiceActor): Promise<TanimlarDTO> {
  rolGerekli(actor, ACTION_ROLES.definitions);

  const [mahalleler, mudurlukler, sikayetTurleri, aracCinsleri, kullanicilar, otomatikAtama] =
    await Promise.all([
      prisma.neighborhood.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, aktif: true },
      }),
      prisma.department.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, shortName: true, aktif: true },
      }),
      prisma.complaintType.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          aktif: true,
          defaultDepartmentId: true,
        },
      }),
      prisma.vehicleType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, aktif: true },
      }),
      prisma.user.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          departmentId: true,
          aktif: true,
          lastLoginAt: true,
        },
      }),
      otomatikAtamaAcikMi(),
    ]);

  return {
    mahalleler,
    mudurlukler,
    sikayetTurleri,
    aracCinsleri,
    kullanicilar,
    otomatikAtama,
  };
}

// MARK: - Yazma

/**
 * Tanım adları veritabanında tekildir. Prisma'nın P2002 hatası kullanıcıya
 * "Beklenmeyen hata" olarak görünmesin diye adı içeren bir mesaja çevrilir.
 */
async function tekilKayit<T>(varlik: string, ad: string, islem: () => Promise<T>): Promise<T> {
  try {
    return await islem();
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ServiceError(`"${ad}" adlı ${varlik} zaten var`, 409);
    }
    throw e;
  }
}

export async function mahalleOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const { name } = adInputSchema.parse(input);
  return tekilKayit("mahalle", name, () =>
    prisma.neighborhood.create({
      data: { name },
      select: { id: true, name: true, aktif: true },
    }),
  );
}

export async function aracCinsiOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const { name } = adInputSchema.parse(input);
  return tekilKayit("araç cinsi", name, () =>
    prisma.vehicleType.create({
      data: { name },
      select: { id: true, name: true, aktif: true },
    }),
  );
}

const mudurlukSecim = {
  id: true,
  name: true,
  shortName: true,
  aktif: true,
} as const;

export async function mudurlukOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = mudurlukInputSchema.parse(input);
  return tekilKayit("müdürlük", data.name, () =>
    prisma.department.create({
      // Kısa ad boş bırakılırsa adın ilk 20 karakteri kullanılır
      data: { name: data.name, shortName: data.shortName ?? data.name.slice(0, 20) },
      select: mudurlukSecim,
    }),
  );
}

export async function mudurlukGuncelle(actor: ServiceActor, id: string, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = mudurlukInputSchema.parse(input);

  const mevcut = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!mevcut) bulunamadi("Müdürlük");

  return tekilKayit("müdürlük", data.name, () =>
    prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        // Kısa ad zorunlu bir alan; boş gönderilirse eskisi korunur
        ...(data.shortName ? { shortName: data.shortName } : {}),
        aktif: data.aktif,
      },
      select: mudurlukSecim,
    }),
  );
}

const sikayetTuruSecim = {
  id: true,
  name: true,
  aktif: true,
  defaultDepartmentId: true,
} as const;

export async function sikayetTuruOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = sikayetTuruInputSchema.parse(input);
  await mudurlukVarMi(data.defaultDepartmentId);

  return tekilKayit("şikayet türü", data.name, () =>
    prisma.complaintType.create({
      data: { name: data.name, defaultDepartmentId: data.defaultDepartmentId ?? null },
      select: sikayetTuruSecim,
    }),
  );
}

export async function sikayetTuruGuncelle(actor: ServiceActor, id: string, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = sikayetTuruInputSchema.parse(input);
  await mudurlukVarMi(data.defaultDepartmentId);

  const mevcut = await prisma.complaintType.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Şikayet türü");

  return tekilKayit("şikayet türü", data.name, () =>
    prisma.complaintType.update({
      where: { id },
      data: {
        name: data.name,
        defaultDepartmentId: data.defaultDepartmentId ?? null,
        aktif: data.aktif,
      },
      select: sikayetTuruSecim,
    }),
  );
}

/** Geçersiz müdürlük kimliği Prisma'da yabancı anahtar hatası verirdi. */
async function mudurlukVarMi(id: string | undefined): Promise<void> {
  if (!id) return;
  const mudurluk = await prisma.department.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mudurluk) bulunamadi("Müdürlük");
}

const kullaniciSecim = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  departmentId: true,
  aktif: true,
  lastLoginAt: true,
} as const;

/** Telefon ve e-posta tekildir; hangisinin çakıştığını mesajda belirtiriz. */
async function kullaniciCakismasi(
  phone: string,
  email: string | undefined,
  haricId?: string,
): Promise<void> {
  const cakisan = await prisma.user.findFirst({
    where: {
      OR: [{ phone }, ...(email ? [{ email }] : [])],
      ...(haricId ? { id: { not: haricId } } : {}),
    },
    select: { phone: true, email: true },
  });
  if (!cakisan) return;
  throw new ServiceError(
    cakisan.phone === phone
      ? "Bu telefon numarası başka bir kullanıcıda kayıtlı"
      : "Bu e-posta başka bir kullanıcıda kayıtlı",
    409,
  );
}

export async function kullaniciOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = kullaniciOlusturSchema.parse(input);
  await mudurlukVarMi(data.departmentId);
  await kullaniciCakismasi(data.phone, data.email);

  const kullanici = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email ?? null,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: data.role,
      departmentId: data.departmentId ?? null,
    },
    select: kullaniciSecim,
  });

  await auditKaydet(actor, "KULLANICI_OLUSTUR", {
    varlik: "User",
    varlikId: kullanici.id,
    detay: { ad: data.name, rol: data.role },
  });
  return kullanici;
}

export async function kullaniciGuncelle(actor: ServiceActor, id: string, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const data = kullaniciGuncelleSchema.parse(input);
  await mudurlukVarMi(data.departmentId);
  await kullaniciCakismasi(data.phone, data.email, id);

  const mevcut = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!mevcut) bulunamadi("Kullanıcı");

  const sifre = data.password ? data.password : undefined;
  // E-posta alanı hiç gönderilmediyse mevcut değer korunur; boş gönderildiyse
  // kullanıcı bilinçli olarak temizlemiş sayılır.
  const epostaGonderildi = alanGonderildi(input, "email");

  const kullanici = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      ...(epostaGonderildi ? { email: data.email ?? null } : {}),
      role: data.role,
      departmentId: data.departmentId ?? null,
      aktif: data.aktif,
      ...(sifre ? { passwordHash: await bcrypt.hash(sifre, 10) } : {}),
    },
    select: kullaniciSecim,
  });

  await auditKaydet(actor, "KULLANICI_GUNCELLE", {
    varlik: "User",
    varlikId: id,
    detay: { rol: data.role, sifreDegisti: Boolean(sifre) },
  });
  return kullanici;
}

export async function otomatikAtamaKaydet(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.definitions);
  const { otomatikAtama } = dispatchAyarSchema.parse(input);

  await otomatikAtamaAyarla(otomatikAtama);
  // Denetim kaydında eski alan adı korunur (web geçmişiyle uyumlu)
  await auditKaydet(actor, "DISPATCH_OTOMATIK_AYAR", {
    detay: { acik: otomatikAtama },
  });
  return { otomatikAtama };
}
