import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { assertComplaintApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { requireMobileUser } from "@/lib/mobile-auth";
import { auditKaydet } from "@/lib/audit";
import {
  cleanupComplaintPhotoFiles,
  saveComplaintPhotosFromBase64,
} from "@/lib/complaint-photos";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await assertComplaintApiAccess(toAccessUser(user), id);
  if (access instanceof Response) return access;

  const body = (await req.json()) as {
    durum?: "ACIK" | "DEVAM_EDIYOR" | "KAPATILDI" | "IPTAL";
    cozumNotu?: string;
    lat?: number;
    lng?: number;
    /** data-URL veya ham base64 dizisi — yalnız KAPATILDI iken yazılır */
    cozumFotolari?: Array<string | { data: string; mime?: string }>;
  };

  if (body.durum) {
    const transition = canTransitionComplaint(access.row.durum, body.durum, user.role);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 400 });
    }
  }

  let cozumFotolari: string[] = [];
  if (body.durum === "KAPATILDI" && body.cozumFotolari?.length) {
    try {
      cozumFotolari = await saveComplaintPhotosFromBase64(body.cozumFotolari);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fotoğraf kaydı başarısız" },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.complaint.update({
        where: { id },
        data: {
          ...(body.durum ? { durum: body.durum } : {}),
          ...(body.cozumNotu !== undefined ? { cozumNotu: body.cozumNotu } : {}),
          ...(body.lat != null ? { lat: body.lat } : {}),
          ...(body.lng != null ? { lng: body.lng } : {}),
          ...(body.durum === "KAPATILDI"
            ? {
                kapanisTarihi: new Date(),
                onaylayanId: user.id,
                ...(cozumFotolari.length > 0
                  ? {
                      photos: {
                        create: cozumFotolari.map((url) => ({
                          url,
                          tip: "COZUM",
                        })),
                      },
                    }
                  : {}),
              }
            : {}),
        },
      });
      await tx.complaintEvent.create({
        data: {
          complaintId: id,
          userId: user.id,
          tip: "MOBIL_GUNCELLEME",
          detay: {
            durum: body.durum,
            cozumNotu: body.cozumNotu,
            lat: body.lat,
            lng: body.lng,
            fotoAdet: cozumFotolari.length,
          },
        },
      });
      return c;
    });

    await auditKaydet({ user }, "SIKAYET_DURUM_GUNCELLE", {
      varlik: "Complaint",
      varlikId: id,
      detay: {
        eski: access.row.durum,
        yeni: body.durum,
        kaynak: "api-mobile",
        fotoAdet: cozumFotolari.length,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    await cleanupComplaintPhotoFiles(cozumFotolari);
    throw e;
  }
}
