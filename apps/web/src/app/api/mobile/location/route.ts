import { NextResponse } from "next/server";
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
