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
