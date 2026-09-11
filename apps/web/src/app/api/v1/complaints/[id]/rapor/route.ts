import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { ONCELIK_LABELS, SIKAYET_DURUM_LABELS } from "@kars/shared";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { assertComplaintApiAccess, toAccessUser } from "@/lib/access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * İş emri / şikayet raporu — web `/sikayetler/[id]/rapor` içeriğinin mobil indirilebilir HTML hali.
 * Tarayıcıda yazdırılabilir; iOS Share Sheet ile paylaşılır.
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "CALL_CENTER",
    "DEPARTMENT_MANAGER",
    "APPROVER",
    "DRIVER",
    "FIELD_WORKER",
  ]);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  const access = await assertComplaintApiAccess(toAccessUser(auth.user), id);
  if (access instanceof Response) return access;

  const s = await prisma.complaint.findUnique({
    where: { id },
    include: {
      neighborhood: true,
      complaintType: true,
      department: true,
      vehicle: { include: { atananSofor: true } },
      personel: { include: { personnel: true } },
      onaylayan: true,
    },
  });
  if (!s) return json({ error: "Not found" }, 404);

  const personel = s.personel.map((p) => p.personnel.adSoyad).join(", ") || "—";
  const esc = (v: string | null | undefined) =>
    (v ?? "—")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(s.sikayetNo)} — İş Emri Raporu</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;margin:24px;line-height:1.45}
  h1{font-size:18px;margin:0 0 4px;color:#0b3a6e}
  .sub{color:#64748b;font-size:12px;margin-bottom:16px}
  .box{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;overflow:hidden}
  .box h2{margin:0;padding:8px 12px;background:#0b3a6e;color:#fff;font-size:13px}
  .row{display:flex;gap:8px;padding:6px 12px;border-top:1px solid #e2e8f0;font-size:13px}
  .k{width:140px;color:#64748b;flex-shrink:0}
  .v{flex:1}
  @media print{body{margin:0}}
</style>
</head>
<body>
  <h1>Kars Belediyesi — Şikayet / İş Emri Raporu</h1>
  <p class="sub">${esc(s.sikayetNo)} · ${s.kayitTarihi.toLocaleString("tr-TR")}</p>

  <div class="box">
    <h2>ŞİKAYET BİLGİLERİ</h2>
    <div class="row"><div class="k">Şikayet No</div><div class="v">${esc(s.sikayetNo)}</div></div>
    <div class="row"><div class="k">Kayıt Tarihi</div><div class="v">${esc(s.kayitTarihi.toLocaleString("tr-TR"))}</div></div>
    <div class="row"><div class="k">Arayan</div><div class="v">${esc(s.arayanKisi)}</div></div>
    <div class="row"><div class="k">Telefon</div><div class="v">${esc(s.telefon)}</div></div>
    <div class="row"><div class="k">Kanal</div><div class="v">${esc(s.kanal)}</div></div>
    <div class="row"><div class="k">Öncelik</div><div class="v">${esc(ONCELIK_LABELS[s.oncelik] ?? s.oncelik)}</div></div>
    <div class="row"><div class="k">Durum</div><div class="v">${esc(SIKAYET_DURUM_LABELS[s.durum] ?? s.durum)}</div></div>
    <div class="row"><div class="k">Tür</div><div class="v">${esc(s.complaintType?.name)}</div></div>
    <div class="row"><div class="k">Müdürlük</div><div class="v">${esc(s.department?.name)}</div></div>
  </div>

  <div class="box">
    <h2>KONUM</h2>
    <div class="row"><div class="k">Mahalle</div><div class="v">${esc(s.neighborhood?.name)}</div></div>
    <div class="row"><div class="k">Adres</div><div class="v">${esc(s.acikAdres)}</div></div>
  </div>

  <div class="box">
    <h2>AÇIKLAMA</h2>
    <div class="row"><div class="v">${esc(s.aciklama)}</div></div>
  </div>

  <div class="box">
    <h2>GÖREVLENDİRME</h2>
    <div class="row"><div class="k">Araç</div><div class="v">${esc(s.vehicle?.plaka)}</div></div>
    <div class="row"><div class="k">Şoför</div><div class="v">${esc(s.soforAdi ?? s.vehicle?.atananSofor?.name)}</div></div>
    <div class="row"><div class="k">Personel</div><div class="v">${esc(personel)}</div></div>
  </div>

  <div class="box">
    <h2>ONAY & ÇÖZÜM</h2>
    <div class="row"><div class="k">Kapanış</div><div class="v">${esc(s.kapanisTarihi?.toLocaleString("tr-TR"))}</div></div>
    <div class="row"><div class="k">Onaylayan</div><div class="v">${esc(s.onaylayan?.name)}</div></div>
    <div class="row"><div class="k">Çözüm Notu</div><div class="v">${esc(s.cozumNotu)}</div></div>
  </div>
</body>
</html>`;

  const filename = `${s.sikayetNo.replaceAll(/[^\w.-]+/g, "_")}-rapor.html`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
