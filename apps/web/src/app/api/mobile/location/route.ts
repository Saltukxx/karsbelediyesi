import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { canAccessVehicle, loadVehicleForAccess, toAccessUser } from "@/lib/access";
import { locationPingSchema } from "@/lib/api-schemas";
import { konumPingKaydet, soforunAraci } from "@/lib/location";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * Şoför telefonundan periyodik konum ping'i.
 * vehicleId verilmezse şoförün devam eden görevindeki ya da zimmetli aracı kullanılır.
 */
export async function POST(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["ADMIN", "DEPARTMENT_MANAGER", "DRIVER", "FIELD_WORKER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = locationPingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // İstemcinin bildirdiği araç doğrulanmadan kabul edilirse başka aracın
  // konumu sahtelenebilir (dispatch, komuta ve rota analizi bozulur).
  if (body.vehicleId && !(await aracaPingYetkisi(user, body.vehicleId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vehicleId = body.vehicleId ?? (await soforunAraci(user.id));
  if (!vehicleId) {
    return NextResponse.json(
      { error: "Şoföre bağlı araç bulunamadı (zimmet veya aktif görev yok)" },
      { status: 404 },
    );
  }

  await konumPingKaydet({
    vehicleId,
    driverId: user.id,
    lat: body.lat,
    lng: body.lng,
    hiz: body.hiz,
    kaynak: "TELEFON",
  });

  return NextResponse.json({ ok: true, vehicleId });
}

/** Zimmet/müdürlük erişimi ya da araç üzerinde devam eden görevi olan şoför */
async function aracaPingYetkisi(
  user: { id: string; role: string; departmentId: string | null },
  vehicleId: string,
): Promise<boolean> {
  const arac = await loadVehicleForAccess(vehicleId);
  if (!arac) return false;
  if (canAccessVehicle(toAccessUser(user), arac)) return true;

  const aktifGorev = await prisma.vehicleTask.findFirst({
    where: { vehicleId, driverId: user.id, durum: "DEVAM_EDIYOR" },
    select: { id: true },
  });
  return aktifGorev != null;
}
