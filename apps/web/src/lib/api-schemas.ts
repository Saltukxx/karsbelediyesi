import { z } from "zod";

/**
 * Yalnızca `/api/mobile/*` (Expo uygulaması) uçlarının şemaları. `/api/v1`
 * tarafında doğrulama servis katmanının Zod şemalarında yapılır, böylece web
 * Server Action'ı ile aynı kurallar geçerli olur.
 */

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
