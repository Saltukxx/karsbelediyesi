import { NextResponse } from "next/server";
import type { AppSession } from "@/lib/authz";
import { withPanelUser } from "@/lib/panel-auth";
import { ServiceError, serviceErrorResponse } from "@/lib/services/base";

/**
 * Panel/mobil JSON route sarmalayıcısı: kimlik doğrulama (Bearer JWT veya
 * NextAuth cookie) + servis hatalarının HTTP karşılığına çevrilmesi.
 *
 * Rol kontrolü servis katmanında yapılır; böylece web Server Action'ı ile
 * API aynı yetki kurallarını paylaşır.
 */
export async function panelRoute(
  req: Request,
  handler: (actor: AppSession) => Promise<NextResponse>,
): Promise<NextResponse> {
  const session = await withPanelUser(req);
  if (session instanceof NextResponse) return session;
  try {
    return await handler(session);
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

/** Gövdesi bozuk JSON olan istekler 400 döner (500 değil). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ServiceError("Geçersiz JSON gövdesi", 400);
  }
}

export async function readFormData(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ServiceError("Geçersiz form gövdesi", 400);
  }
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function ok<T>(data: T): NextResponse {
  return NextResponse.json(data);
}
