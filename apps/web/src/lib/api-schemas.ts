import { z } from "zod";

export const complaintCreateSchema = z.object({
  arayanKisi: z.string().min(1, "Arayan kişi zorunlu"),
  telefon: z.string().optional(),
  neighborhoodId: z.string().optional(),
  acikAdres: z.string().optional(),
  complaintTypeId: z.string().optional(),
  departmentId: z.string().optional(),
  aciklama: z.string().optional(),
  oncelik: z.enum(["NORMAL", "ACIL", "COK_ACIL"]).optional(),
  kanal: z.enum(["TELEFON", "WHATSAPP", "WEB"]).optional(),
});

export const complaintPatchSchema = z.object({
  durum: z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]).optional(),
  cozumNotu: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  departmentId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  personnelIds: z.array(z.string()).optional(),
  geocode: z.boolean().optional(),
  cozumFotolari: z
    .array(z.union([z.string(), z.object({ data: z.string(), mime: z.string().optional() })]))
    .optional(),
});

export const islerimDurumSchema = z.object({
  durum: z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]),
  cozumNotu: z.string().optional(),
});

export const checklistCreateSchema = z.object({
  templateId: z.string().min(1),
  vehicleId: z.string().min(1),
  ay: z.number().int().min(1).max(12),
  yilDonem: z.number().int(),
  sorumluOperatorTeknisyen: z.string().optional(),
  santiyeLokasyon: z.string().optional(),
});

export const worklogCreateSchema = z.object({
  kind: z.enum(["personel", "arac"]),
  personnelId: z.string().optional(),
  vehicleId: z.string().optional(),
  tarih: z.string().min(1),
  girisSaati: z.string().min(1),
  cikisSaati: z.string().min(1),
  yapilanIs: z.string().optional(),
  gorevTanimi: z.string().optional(),
});

export const whatsappReplySchema = z.object({
  complaintId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const routeWriteSchema = z.object({
  ad: z.string().min(1),
  koordinatlar: z.unknown(),
  notlar: z.string().optional(),
  oncelik: z.number().optional(),
});

export const personnelWriteSchema = z.object({
  adSoyad: z.string().min(1),
  unvan: z.string().optional(),
  departmentId: z.string().optional(),
  telefon: z.string().optional(),
  durum: z.enum(["AKTIF", "IZINLI", "RAPORLU", "AYRILDI"]).optional(),
});

export const vehicleWriteSchema = z.object({
  plaka: z.string().min(1),
  marka: z.string().optional(),
  model: z.string().optional(),
  departmentId: z.string().optional(),
  vehicleTypeId: z.string().optional(),
});

export const taskActionSchema = z.object({
  action: z.enum(["start", "close"]),
  kmSayacCikis: z.number().optional(),
  kmSayacGiris: z.number().optional(),
});

export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** km/sa */
  hiz: z.number().nonnegative().optional(),
  /** Verilmezse şoförün aktif görev / zimmet aracı bulunur */
  vehicleId: z.string().optional(),
});

export const fuelCreateSchema = z.object({
  vehicleId: z.string().min(1),
  litre: z.number().positive(),
  birimFiyat: z.number().nonnegative(),
  sayac: z.number().optional(),
  yakitTuru: z.string().optional(),
});
