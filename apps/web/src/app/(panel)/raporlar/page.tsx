import { ONCELIK_LABELS } from "@kars/shared";
import { cardCls, btnPrimary } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { requirePageAccess } from "@/lib/authz";
import { paraFormat } from "@/lib/task-cost";
import {
  exportKatalogu,
  isMaliyetiRaporu,
  mahalleAnalizi,
  raporOzeti,
} from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export default async function RaporlarPage() {
  const session = await requirePageAccess("/raporlar");
  // Hesaplar servis katmanında; mobil uygulama da aynı uçları kullanır
  const [ozet, mahalleler, maliyet] = await Promise.all([
    raporOzeti(session),
    mahalleAnalizi(session),
    isMaliyetiRaporu(session),
  ]);
  const { sla } = ozet;
  const maliyetSatirlari = maliyet.satirlar;
  const mudurlukToplamlari = maliyet.mudurlukToplamlari;
  const exportlar = exportKatalogu(session);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Raporlar & Dışa Aktarma" />
        <p className="text-sm text-kb-muted">
          SLA özeti, müdürlük performansı ve Excel dışa aktarma.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Şikayet SLA</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["24 saatten az", sla.bucketLt24h, "Açık kayıtlar"],
            ["1–3 gün", sla.bucket1to3d, "Orta yaş"],
            ["3 günden fazla", sla.bucketGt3d, "Geciken"],
          ].map(([label, val, hint]) => (
            <div key={String(label)} className={`${cardCls} p-4`}>
              <div className="text-xs text-kb-muted">{label}</div>
              <div className="text-2xl font-semibold mt-1 text-kb-navy">{val}</div>
              <div className="text-xs text-kb-muted mt-1">{hint}</div>
            </div>
          ))}
        </div>

        {sla.overdueUrgent.length > 0 && (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="border-b border-kb-border px-4 py-3 font-medium">
              Geciken acil / çok acil (24 saatten fazla)
            </div>
            <DataTable framed={false}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Arayan</th>
                  <th>Öncelik</th>
                  <th>Müdürlük</th>
                  <th>Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {sla.overdueUrgent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/sikayetler/${s.id}`}
                        className="font-mono text-xs text-kb-navy hover:underline"
                      >
                        {s.sikayetNo}
                      </Link>
                    </td>
                    <td>{s.arayanKisi}</td>
                    <td>
                      <StatusBadge
                        label={
                          ONCELIK_LABELS[s.oncelik as keyof typeof ONCELIK_LABELS] ??
                          s.oncelik
                        }
                      />
                    </td>
                    <td>{s.departmentName ?? "—"}</td>
                    <td className="text-xs text-kb-muted">
                      {s.kayitTarihi.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-kb-border px-4 py-3 font-medium">
            Müdürlük KPI (son 30 gün kapanış)
          </div>
          <DataTable
            framed={false}
            empty={sla.byDepartment.length === 0}
            emptyTitle="Veri yok"
          >
            <thead>
              <tr>
                <th>Müdürlük</th>
                <th>Açık</th>
                <th>Kapatılan (30g)</th>
                <th>Ort. kapanış (gün)</th>
              </tr>
            </thead>
            <tbody>
              {sla.byDepartment.map((row) => (
                <tr key={row.departmentId ?? "none"}>
                  <td>{row.departmentName}</td>
                  <td>{row.acik}</td>
                  <td>{row.kapatilan30g}</td>
                  <td>{row.ortKapanisGun ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">
          Mahalle Analizi (son 90 gün)
        </h2>
        <div className={`${cardCls} overflow-hidden`}>
          <DataTable
            framed={false}
            empty={mahalleler.length === 0}
            emptyTitle="Son 90 günde konumlu şikayet yok"
          >
            <thead>
              <tr>
                <th>Mahalle</th>
                <th>Toplam</th>
                <th>Açık</th>
                <th>Kapanan</th>
                <th>Ort. çözüm (gün)</th>
                <th>En sık tip</th>
              </tr>
            </thead>
            <tbody>
              {mahalleler.map((m) => (
                <tr key={m.ad}>
                  <td className="font-medium">{m.ad}</td>
                  <td>{m.toplam}</td>
                  <td>{m.acik > 0 ? <StatusBadge label={String(m.acik)} /> : 0}</td>
                  <td>{m.kapanan}</td>
                  <td>{m.ortCozumGun ?? "—"}</td>
                  <td className="text-xs text-kb-muted">{m.enSikTip}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">
          İş Maliyeti (son 30 gün kapanan görevler)
        </h2>
        <div className={`${cardCls} overflow-hidden`}>
          <DataTable
            framed={false}
            empty={maliyetSatirlari.length === 0}
            emptyTitle="Son 30 günde kapanan görev yok"
          >
            <thead>
              <tr>
                <th>Görev</th>
                <th>Plaka</th>
                <th>Müdürlük</th>
                <th>Yakıt</th>
                <th>Malzeme</th>
                <th>İşçilik</th>
                <th>Diğer</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {maliyetSatirlari.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="font-mono text-xs">{s.gorevNo}</span>
                    {s.gorevTanimi && (
                      <div className="max-w-[220px] truncate text-xs text-kb-muted">
                        {s.gorevTanimi}
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-xs">{s.plaka}</td>
                  <td>{s.mudurluk}</td>
                  <td>
                    {paraFormat(s.maliyet.yakit)}
                    {s.maliyet.yakitTahmini && (
                      <span className="ml-1 text-xs text-kb-muted">(tahmini)</span>
                    )}
                  </td>
                  <td>{paraFormat(s.maliyet.malzeme)}</td>
                  <td>{paraFormat(s.maliyet.iscilik)}</td>
                  <td>{paraFormat(s.maliyet.diger)}</td>
                  <td className="font-semibold">{paraFormat(s.maliyet.toplam)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        {mudurlukToplamlari.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {mudurlukToplamlari.map((m) => (
              <div key={m.mudurluk} className={`${cardCls} p-4`}>
                <div className="text-xs text-kb-muted">{m.mudurluk}</div>
                <div className="text-xl font-semibold mt-1">{paraFormat(m.toplam)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Toplam şikayet", ozet.toplamSikayet],
          ["Araç", ozet.toplamArac],
          ["Görev", ozet.toplamGorev],
          ["Yakıt + Bakım (₺)", ozet.yakitBakimToplam.toLocaleString("tr-TR")],
        ].map(([label, val]) => (
          <div key={String(label)} className={`${cardCls} p-4`}>
            <div className="text-xs text-kb-muted">{label}</div>
            <div className="text-xl font-semibold mt-1">{val}</div>
          </div>
        ))}
      </div>

      <section className={`${cardCls} divide-y divide-slate-100`}>
        {exportlar.map((e) => (
          <div key={e.entity} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{e.baslik}</div>
              <Link href={e.href} className="text-xs text-kb-navy hover:underline">
                Listeye git
              </Link>
            </div>
            <a href={`/api/export/${e.entity}`} className={btnPrimary}>
              Excel İndir
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
