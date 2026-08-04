import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";
import {
  apiDeny,
  apiNotFound,
  canAccessComplaint,
  toAccessUser,
} from "@/lib/access";
import { resolveComplaintPhotoPath } from "@/lib/complaint-photos";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const photo = await prisma.complaintPhoto.findUnique({
    where: { id },
    select: {
      url: true,
      complaint: {
        select: {
          id: true,
          departmentId: true,
          vehicle: { select: { atananSoforId: true } },
          personel: {
            include: { personnel: { select: { userId: true } } },
          },
        },
      },
    },
  });
  if (!photo) return apiNotFound();

  if (!canAccessComplaint(toAccessUser(session.user), photo.complaint)) {
    return apiDeny();
  }

  const filePath = await resolveComplaintPhotoPath(photo.url);
  if (!filePath) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";

  const data = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
