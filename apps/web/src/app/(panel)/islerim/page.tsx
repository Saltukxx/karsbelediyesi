import Link from "next/link";
import { prisma } from "@kars/db";
import {
  ONCELIK_LABELS,
  SIKAYET_DURUM_LABELS,
  KANAL_LABELS,
} from "@kars/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requirePageAccess } from "@/lib/authz";
import { islerimAsfaltDurum } from "@/lib/actions/islerim";
import { gorevBaslat, gorevKapat } from "@/lib/actions/tasks";
import { inputCls, btnSecondary } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ASFALT_DURUM_LABELS: Record<string, string> = {
  PLANLANDI: "Planlandı",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
};

const GOREV_DURUM_LABELS: Record<string, string> = {
  PLANLANDI: "Planlandı",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL_EDILDI: "İptal",
};

export default async function IslerimPage() {
  const session = await requirePageAccess("/islerim");

  const [personel, aracGorevleri] = await Promise.all([
    prisma.personnel.findFirst({
      where: { userId: session.user.id },
      select: { id: true, adSoyad: true, department: { select: { name: true } } },
    }),
    // Şoför olarak üzerine atanan araç görevleri (personel kaydı olmasa da görünür)
    prisma.vehicleTask.findMany({
      where: { driverId: session.user.id },
      orderBy: [{ durum: "asc" }, { talepTarihi: "desc" }],
      take: 20,
      select: {
        id: true,
        gorevNo: true,
        durum: true,
        gorevYeri: true,
        gorevTanimi: true,
        cikisTarihi: true,
        girisTarihi: true,
        dispatchJobId: true,
        kmSayacCikis: true,
        kmSayacGiris: true,
        vehicle: { select: { plaka: true, sayacDeger: true } },
      },
    }),
  ]);

  if (!personel && aracGorevleri.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="İşlerim" description="Size atanan şikayetler ve asfalt rotaları" />
        <div className="rounded-lg border border-kb-border bg-white p-6 text-sm text-kb-muted shadow-sm">
          Hesabınıza bağlı bir personel kaydı bulunamadı. Lütfen yöneticinizle
          iletişime geçin.
        </div>
      </div>
    );
  }

  const [sikayetAtamalari, rotaAtamalari] = personel
    ? await Promise.all([
        prisma.complaintPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            complaint: {
              include: {
                complaintType: true,
                neighborhood: true,
                department: true,
              },
            },
          },
        }),
        prisma.asphaltRoadPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            asphaltRoad: { include: { department: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const sikayetler = sikayetAtamalari
    .map((a) => a.complaint)
    .sort((a, b) => b.kayitTarihi.getTime() - a.kayitTarihi.getTime());
  const acikSikayetler = sikayetler.filter(
    (s) => s.durum === "ACIK" || s.durum === "DEVAM_EDIYOR",
  );
  const kapaliSikayetler = sikayetler.filter(
    (s) => s.durum === "KAPATILDI" || s.durum === "IPTAL",
  );
  const rotalar = rotaAtamalari.map((a) => a.asphaltRoad);
  const aktifGorevler = aracGorevleri.filter(
    (g) => g.durum === "PLANLANDI" || g.durum === "DEVAM_EDIYOR",
  );

  const today = new Date().toISOString().slice(0, 10);

  function SikayetKart({ s }: { s: (typeof sikayetler)[number] }) {
    return (
      <Link
        href={`/islerim/${s.id}`}
        className="block rounded-lg border border-kb-border bg-white p-4 shadow-sm hover:border-kb-navy/40 hover:shadow"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-kb-ink">{s.sikayetNo}</span>
          <StatusBadge label={SIKAYET_DURUM_LABELS[s.durum]} />
          <StatusBadge label={ONCELIK_LABELS[s.oncelik]} />
          <span className="text-xs text-kb-muted">{KANAL_LABELS[s.kanal]}</span>
        </div>
        <div className="mt-1.5 text-sm text-kb-muted">
          {[s.complaintType?.name, s.neighborhood?.name, s.acikAdres]
            .filter(Boolean)
            .join(" · ") || "—"}
        </div>
        {s.aciklama && (
          <p className="mt-1.5 line-clamp-2 text-sm text-kb-ink">{s.aciklama}</p>
        )}
        <div className="mt-2 text-xs text-kb-muted">
          {s.kayitTarihi.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
          {s.department ? ` · ${s.department.name}` : ""}
        </div>
      </Link>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="İşlerim"
        description={`${personel?.adSoyad ?? session.user.name}${personel?.department ? ` — ${personel.department.name}` : ""} · size atanan işler`}
      />

      {aracGorevleri.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
            Araç Görevleri ({aktifGorevler.length} aktif)
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {aracGorevleri.map((g) => (
              <div
                key={g.id}
                className="rounded-lg border border-kb-border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-kb-ink">{g.gorevNo}</span>
                  <StatusBadge label={GOREV_DURUM_LABELS[g.durum] ?? g.durum} />
                  <span className="text-xs text-kb-muted">{g.vehicle.plaka}</span>
                </div>
                <div className="mt-1.5 text-sm text-kb-muted">
                  {[g.gorevTanimi, g.gorevYeri].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-kb-muted">
                  <span>
                    {g.cikisTarihi
                      ? `Çıkış: ${g.cikisTarihi.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`
                      : "Çıkış yapılmadı"}
                  </span>
                  {g.girisTarihi && (
                    <span>
                      Dönüş:{" "}
                      {g.girisTarihi.toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                  {g.dispatchJobId && (
                    <Link
                      href={`/gorevler/${g.id}/takip`}
                      className="font-medium text-kb-navy hover:underline"
                    >
                      Takip raporu →
                    </Link>
                  )}
                </div>
                {g.durum === "PLANLANDI" && (
                  <form action={gorevBaslat} className="mt-3 flex flex-col gap-1">
                    <input type="hidden" name="id" value={g.id} />
                    <input
                      name="kmSayacCikis"
                      type="number"
                      step="0.1"
                      placeholder="KM çıkış"
                      defaultValue={g.kmSayacCikis ?? g.vehicle.sayacDeger ?? ""}
                      className={inputCls}
                    />
                    <button className={btnSecondary}>Başlat</button>
                  </form>
                )}
                {(g.durum === "PLANLANDI" || g.durum === "DEVAM_EDIYOR") && (
                  <form action={gorevKapat} className="mt-2 flex flex-col gap-1">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="girisTarihi" type="date" defaultValue={today} className={inputCls} />
                    <input name="girisSaati" type="time" className={inputCls} />
                    <input
                      name="kmSayacGiris"
                      type="number"
                      step="0.1"
                      placeholder="KM giriş"
                      className={inputCls}
                    />
                    <select name="durum" defaultValue="TAMAMLANDI" className={inputCls}>
                      <option value="TAMAMLANDI">Tamamlandı</option>
                      <option value="IPTAL_EDILDI">İptal</option>
                    </select>
                    <button className={btnSecondary}>Kapat</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {personel && (
        <section className="space-y-3">
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
            Açık Şikayetler ({acikSikayetler.length})
          </h2>
          {acikSikayetler.length === 0 ? (
            <p className="rounded-lg border border-kb-border bg-white p-4 text-sm text-kb-muted shadow-sm">
              Size atanmış açık şikayet yok.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {acikSikayetler.map((s) => (
                <SikayetKart key={s.id} s={s} />
              ))}
            </div>
          )}
        </section>
      )}

      {personel && (
        <section className="space-y-3">
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
            Asfalt Rotaları ({rotalar.length})
          </h2>
          {rotalar.length === 0 ? (
            <p className="rounded-lg border border-kb-border bg-white p-4 text-sm text-kb-muted shadow-sm">
              Size atanmış asfalt rotası yok.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rotalar.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-kb-border bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-kb-ink">{r.ad}</span>
                    <StatusBadge label={ASFALT_DURUM_LABELS[r.durum] ?? r.durum} />
                  </div>
                  <div className="mt-1.5 text-xs text-kb-muted">
                    {r.department?.name ?? "Müdürlük atanmadı"}
                    {r.dokumTarihi
                      ? ` · Döküm: ${r.dokumTarihi.toLocaleDateString("tr-TR")}`
                      : ""}
                  </div>
                  {r.notlar && <p className="mt-1.5 text-sm text-kb-ink">{r.notlar}</p>}
                  <form action={islerimAsfaltDurum} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="durum" defaultValue={r.durum} className={inputCls}>
                      <option value="PLANLANDI">Planlandı</option>
                      <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                      <option value="TAMAMLANDI">Tamamlandı</option>
                    </select>
                    <button className="rounded-md bg-kb-navy px-4 py-2 text-sm text-white hover:bg-kb-navy-soft">
                      Güncelle
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {kapaliSikayetler.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-brand text-[0.95rem] font-semibold text-kb-ink">
            Kapanan Şikayetler ({kapaliSikayetler.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {kapaliSikayetler.map((s) => (
              <SikayetKart key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
