import { json, withApiUser } from "@/lib/api-v1";
import { apiUserToSession } from "@/lib/api-session";
import { computeDashboard } from "@/lib/dashboard";
import { resolveRange } from "@/lib/dashboard-range";
import { computeSlaSummary } from "@/lib/sla";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;

  const session = apiUserToSession(auth.user);
  const url = new URL(req.url);
  const range = resolveRange(
    url.searchParams.get("aralik") ?? undefined,
    url.searchParams.get("bas") ?? undefined,
    url.searchParams.get("bit") ?? undefined,
  );

  const [data, sla] = await Promise.all([
    computeDashboard(session, range),
    computeSlaSummary(session),
  ]);

  const { anlik } = data;

  return json({
    ...data,
    sla,
    preset: range.preset,
    bas: range.bas.toISOString(),
    bit: range.bit.toISOString(),
    acikSikayetler: anlik.acikSikayet,
    devamEdenSikayetler: anlik.devamEdenSikayet,
    bekleyenWhatsApp: anlik.onayBekleyenWhatsApp,
    aktifGorevler: anlik.devamGorev,
    aktifAraclar: anlik.aracEnvanter.AKTIF ?? 0,
    bakimGereken: anlik.yaklasanMuayene,
    dusukStokMalzeme: anlik.kritikStokToplam,
  });
}
