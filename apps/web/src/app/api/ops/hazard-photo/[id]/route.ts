import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";
import { resolveHazardPhotoPath } from "@/lib/hazard-photos";

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
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const photo = await prisma.roadHazardPhoto.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Fotoğraf yok" }, { status: 404 });
  }

  const filePath = await resolveHazardPhotoPath(photo.url);
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
