import { z } from "zod";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import {
  sikayetAta,
  sikayetMudurlukAta,
  sikayetPersonelAta,
} from "@/lib/services/complaints";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Üç atama işlemi tek uçta toplanır; her birinin rol kuralı farklı olduğu için
 * `islem` ayırıcısı zorunludur (web'de üç ayrı form vardır).
 */
const atamaSchema = z.discriminatedUnion("islem", [
  z.object({
    islem: z.literal("MUDURLUK"),
    departmentId: z.string().trim().min(1).nullable(),
  }),
  z.object({
    islem: z.literal("PERSONEL"),
    personnelIds: z.array(z.string().trim().min(1)).min(1, "En az bir personel seçin"),
  }),
  z.object({
    islem: z.literal("ARAC"),
    vehicleId: z.string().trim().min(1).nullable().optional(),
    personnelIds: z.array(z.string().trim().min(1)).optional(),
  }),
]);

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const body = atamaSchema.parse(await readJson(req));
    switch (body.islem) {
      case "MUDURLUK": {
        const guncel = await sikayetMudurlukAta(actor, id, {
          departmentId: body.departmentId,
        });
        return ok({ id, departmentId: guncel.departmentId, durum: guncel.durum });
      }
      case "PERSONEL": {
        await sikayetPersonelAta(actor, id, { personnelIds: body.personnelIds });
        return ok({ id, personnelIds: body.personnelIds });
      }
      case "ARAC": {
        await sikayetAta(actor, id, {
          vehicleId: body.vehicleId,
          personnelIds: body.personnelIds ?? [],
        });
        return ok({
          id,
          vehicleId: body.vehicleId ?? null,
          personnelIds: body.personnelIds ?? [],
        });
      }
      default: {
        const _tukendi: never = body;
        return _tukendi;
      }
    }
  });
}
