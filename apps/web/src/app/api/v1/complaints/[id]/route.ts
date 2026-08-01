import { prisma } from "@kars/db";
import { canAccessComplaint, toAccessUser } from "@/lib/access";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import {
  complaintInclude,
  serializeComplaint,
  serializeComplaintEvent,
} from "@/lib/api/complaint-dto";
import { ACTION_ROLES } from "@/lib/authz";
import { bulunamadi, rolGerekli, ServiceError } from "@/lib/services/base";
import { sikayetDurumGuncelle } from "@/lib/services/complaints";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Şikayet kartı: bilgiler + atanan personel + olay zaman çizelgesi + fotoğraflar. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    rolGerekli(actor, ACTION_ROLES.complaints);

    const row = await prisma.complaint.findUnique({
      where: { id },
      include: {
        ...complaintInclude,
        // `canAccessComplaint` şoför zimmetine bakar; erişim alanları da gerekir.
        vehicle: { select: { id: true, plaka: true, atananSoforId: true } },
        onaylayan: { select: { name: true } },
        photos: { select: { id: true, url: true, tip: true } },
        personel: {
          include: {
            personnel: {
              select: {
                id: true,
                adSoyad: true,
                unvan: true,
                telefon: true,
                userId: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { name: true } } },
        },
      },
    });
    if (!row) bulunamadi("Şikayet");
    if (!canAccessComplaint(toAccessUser(actor.user), row)) {
      throw new ServiceError("Yetkisiz", 403);
    }

    return ok({
      ...serializeComplaint(row),
      // İş emri raporunun "Onaylayan" imza alanı
      onaylayanAdi: row.onaylayan?.name ?? null,
      fotograflar: row.photos.map((f) => ({ id: f.id, url: f.url, tip: f.tip })),
      personel: row.personel.map((p) => ({
        id: p.personnel.id,
        adSoyad: p.personnel.adSoyad,
        unvan: p.personnel.unvan,
        telefon: p.personnel.telefon,
      })),
      olaylar: row.events.map(serializeComplaintEvent),
    });
  });
}

/** Durum geçişi (web formuyla aynı servis: geçiş kuralı, kapanış notu, olay kaydı). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const guncel = await sikayetDurumGuncelle(actor, id, await readJson(req));
    const row = await prisma.complaint.findUniqueOrThrow({
      where: { id: guncel.id },
      include: complaintInclude,
    });
    return ok(serializeComplaint(row));
  });
}
