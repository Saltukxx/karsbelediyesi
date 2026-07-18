import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  amr: "audio/amr",
  wav: "audio/wav",
};

function mediaRoots(): string[] {
  return [
    process.env.WHATSAPP_BOT_MEDIA_PATH,
    path.join(process.cwd(), "../../apps/whatsapp-bot/data/media"),
    path.join(process.cwd(), "../whatsapp-bot/data/media"),
  ].filter(Boolean) as string[];
}

async function resolveSafeMediaPath(medyaUrl: string): Promise<string | null> {
  const fileName = path.basename(medyaUrl);
  if (!fileName || fileName.includes("..")) return null;

  for (const root of mediaRoots()) {
    try {
      const realRoot = await fs.realpath(root);
      const candidate = path.join(realRoot, fileName);
      const real = await fs.realpath(candidate);
      if (!real.startsWith(realRoot + path.sep)) continue;
      await fs.access(real);
      return real;
    } catch {
      /* try next root */
    }
  }

  // Fallback: absolute path written by bot, if it lives under a media root
  try {
    const real = await fs.realpath(medyaUrl);
    for (const root of mediaRoots()) {
      try {
        const realRoot = await fs.realpath(root);
        if (real === realRoot || real.startsWith(realRoot + path.sep)) {
          return real;
        }
      } catch {
        /* next */
      }
    }
  } catch {
    /* not found */
  }

  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles(ACTION_ROLES.whatsapp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Yetkisiz" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  const { id } = await ctx.params;
  const msg = await prisma.whatsAppMessage.findUnique({
    where: { id },
    select: { id: true, medyaUrl: true, medyaTipi: true },
  });

  if (!msg?.medyaUrl) {
    return NextResponse.json({ error: "Medya yok" }, { status: 404 });
  }

  const filePath = await resolveSafeMediaPath(msg.medyaUrl);
  if (!filePath) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType =
    MIME_BY_EXT[ext] ||
    (msg.medyaTipi === "audio" ? "audio/ogg" : "application/octet-stream");

  const data = await fs.readFile(filePath);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
