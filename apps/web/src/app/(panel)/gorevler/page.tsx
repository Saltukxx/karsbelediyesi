import { prisma } from "@kars/db";
import { GOREV_DURUM_LABELS, OPERASYON_DURUM_LABELS } from "@kars/shared";
import { gorevOlustur, gorevBaslat, gorevKapat } from "@/lib/actions/tasks";
import { inputCls, btnPrimary, btnSecondary, cardCls, formCardCls } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StickyFilter } from "@/components/ui/StickyFilter";
import { DataTable } from "@/components/ui/DataTable";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { Pagination, pageSize, parsePage } from "@/components/ui/Pagination";
import { gorevMaliyetleri, paraFormat } from "@/lib/task-cost";

export const dynamic = "force-dynamic";

export default async function GorevlerPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; page?: string; size?: string }>;
}) {
  const session = await requirePageAccess("/gorevler");
  const sp = await searchParams;
  const durumFilter = sp.durum;
  const page = parsePage(sp.page);
  const take = pageSize(sp.size, 25);
  const skip = (page - 1) * take;
  const dept = departmentScope(session);

  const taskWhere = {
    ...(durumFilter ? { durum: durumFilter as never } : {}),
    ...(dept.departmentId
      ? {
          OR: [
            { talepEdenDepartmentId: dept.departmentId },
            { vehicle: { departmentId: dept.departmentId } },
          ],
        }
      : {}),
  };

  const [total, gorevler, araclar, mudurlukler, soforler, onaylayanlar, ozetMudurluk, ozetTip, durumSayac] =
    await Promise.all([
      prisma.vehicleTask.count({ where: taskWhere }),
      prisma.vehicleTask.findMany({
        where: taskWhere,
        orderBy: { talepTarihi: "desc" },
        skip,
        take,
        include: {
          vehicle: { include: { vehicleType: true } },
          driver: true,
          talepEdenDepartment: true,
          onaylayan: true,
        },
      }),
      prisma.vehicle.findMany({
        where: {
          envanterDurumu: { not: "HURDAYA_AYRILDI" },
          ...dept,
        },
        orderBy: { plaka: "asc" },
        include: { atananSofor: true, vehicleType: true },
      }),
      prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({
        where: { role: { in: ["DRIVER", "FIELD_WORKER"] }, aktif: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: { in: ["APPROVER", "ADMIN"] }, aktif: true },
        orderBy: { name: "asc" },
      }),
      prisma.vehicleTask.groupBy({
        by: ["talepEdenDepartmentId", "durum"],
        _count: true,
        _sum: { sureSaat: true },
      }),
      prisma.vehicle.findMany({
        select: {
          vehicleTypeId: true,
          vehicleType: { select: { name: true } },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.vehicle.groupBy({
        by: ["operasyonDurumu"],
        _count: true,
      }),
    ]);

  const mudurlukMap = Object.fromEntries(mudurlukler.map((m) => [m.id, m]));
  const mudurlukOzet = mudurlukler.map((m) => {
    const rows = ozetMudurluk.filter((r) => r.talepEdenDepartmentId === m.id);
    return {
      id: m.id,
      name: m.shortName || m.name,
      toplam: rows.reduce((s, r) => s + r._count, 0),
      tamamlanan: rows.find((r) => r.durum === "TAMAMLANDI")?._count ?? 0,
      devam: rows.find((r) => r.durum === "DEVAM_EDIYOR")?._count ?? 0,
      planlanan: rows.find((r) => r.durum === "PLANLANDI")?._count ?? 0,
      iptal: rows.find((r) => r.durum === "IPTAL_EDILDI")?._count ?? 0,
      sure: rows.reduce((s, r) => s + (r._sum.sureSaat ?? 0), 0),
    };
  });

  const tipMap = new Map<string, { name: string; gorev: number; adet: number }>();
  for (const a of ozetTip) {
    const key = a.vehicleTypeId ?? "_diger";
    const name = a.vehicleType?.name ?? "Diğer";
    const cur = tipMap.get(key) ?? { name, gorev: 0, adet: 0 };
    cur.gorev += a._count.tasks;
    cur.adet += 1;
    tipMap.set(key, cur);
  }

  const maliyetler = await gorevMaliyetleri(
    gorevler
      .filter((g) => g.durum === "TAMAMLANDI")
      .map((g) => ({
        id: g.id,
        sureSaat: g.sureSaat,
        kmFarki: g.kmFarki,
        driverId: g.driverId,
        vehicleId: g.vehicleId,
        normTuketim: g.vehicle.normTuketim,
        manuelMaliyet: g.maliyet != null ? Number(g.maliyet) : null,
      })),
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Görevlendirme"
          description="Görev Formu + Çıkış-Giriş Takip. Süre ve KM farkı otomatik hesaplanır."
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {durumSayac.map((d) => (
            <span
              key={d.operasyonDurumu}
              className="rounded-full bg-kb-surface px-3 py-1"
            >
              {OPERASYON_DURUM_LABELS[d.operasyonDurumu]}: {d._count}
            </span>
          ))}
        </div>
      </div>

      <form action={gorevOlustur} className={`${formCardCls} grid md:grid-cols-3 lg:grid-cols-4 gap-3 items-end !max-w-none`}>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Araç (Plaka) *</label>
          <select name="vehicleId" required className={inputCls}>
            <option value="">— Seçiniz —</option>
            {araclar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.plaka} — {a.vehicleType?.name ?? a.ad ?? ""} ({a.atananSofor?.name ?? "şoför yok"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Talebi Yapan Müdürlük</label>
          <select name="talepEdenDepartmentId" className={inputCls}>
            <option value="">— Seçiniz —</option>
            {mudurlukler.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Görev Yeri</label>
          <input name="gorevYeri" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Görev Tanımı</label>
          <input name="gorevTanimi" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Çıkış Tarihi</label>
          <input name="cikisTarihi" type="date" defaultValue={today} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Çıkış Saati</label>
          <input name="cikisSaati" type="time" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Şoför / Operatör</label>
          <select name="driverId" className={inputCls}>
            <option value="">— Zimmetten —</option>
            {soforler.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">KM/Saat Çıkış</label>
          <input name="kmSayacCikis" type="number" step="0.1" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Onaylayan</label>
          <select name="onaylayanId" className={inputCls}>
            <option value="">— Seçiniz —</option>
            {onaylayanlar.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Durum</label>
          <select name="durum" defaultValue="PLANLANDI" className={inputCls}>
            {Object.entries(GOREV_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Maliyet (₺)</label>
          <input name="maliyet" type="number" step="0.01" className={inputCls} />
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs text-kb-muted block mb-1">Not</label>
          <input name="not" className={inputCls} />
        </div>
        <button className={`${btnPrimary} lg:col-span-4 md:col-span-3`}>+ Görev Oluştur</button>
      </form>

      <StickyFilter>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/gorevler" className={!durumFilter ? "font-semibold text-kb-navy" : "text-kb-muted"}>
            Tümü
          </Link>
          {Object.entries(GOREV_DURUM_LABELS).map(([k, v]) => (
            <Link
              key={k}
              href={`/gorevler?durum=${k}`}
              className={durumFilter === k ? "font-semibold text-kb-navy" : "text-kb-muted"}
            >
              {v}
            </Link>
          ))}
        </div>
      </StickyFilter>

      <DataTable
        minWidth="1100px"
        empty={gorevler.length === 0}
        emptyTitle="Henüz görev yok"
        emptyDescription="Üstteki formdan yeni görev oluşturabilirsiniz."
      >
        <thead>
          <tr>
            <th>Görev No</th>
            <th>Tarih</th>
            <th>Plaka</th>
            <th>Cinsi</th>
            <th>Müdürlük</th>
            <th>Yer / Tanım</th>
            <th>Şoför</th>
            <th>Süre</th>
            <th>KM Fark</th>
            <th>Maliyet</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {gorevler.map((g) => (
            <tr key={g.id} className="group align-top">
              <td className="font-mono text-xs">{g.gorevNo}</td>
              <td>{g.talepTarihi.toLocaleDateString("tr-TR")}</td>
              <td>
                <Link href={`/araclar/${g.vehicleId}`} className="font-mono text-kb-navy hover:underline">
                  {g.vehicle.plaka}
                </Link>
              </td>
              <td>{g.vehicle.vehicleType?.name ?? "—"}</td>
              <td>
                {g.talepEdenDepartment
                  ? mudurlukMap[g.talepEdenDepartment.id]?.shortName || g.talepEdenDepartment.name
                  : "—"}
              </td>
              <td className="max-w-[200px]">
                <div className="font-medium">{g.gorevYeri ?? "—"}</div>
                <div className="truncate text-xs text-kb-muted">{g.gorevTanimi}</div>
              </td>
              <td>{g.driver?.name ?? "—"}</td>
              <td>{g.sureSaat != null ? `${g.sureSaat.toFixed(1)} sa` : "—"}</td>
              <td>{g.kmFarki != null ? g.kmFarki : "—"}</td>
              <td>
                {(() => {
                  const m = maliyetler.get(g.id);
                  if (!m || m.toplam === 0) return "—";
                  return (
                    <span
                      className="font-medium"
                      title={`Yakıt: ${paraFormat(m.yakit)}${m.yakitTahmini ? " (tahmini)" : ""} · Malzeme: ${paraFormat(m.malzeme)} · İşçilik: ${paraFormat(m.iscilik)} · Diğer: ${paraFormat(m.diger)}`}
                    >
                      {paraFormat(m.toplam)}
                      {m.yakitTahmini && (
                        <span className="ml-1 text-xs text-kb-muted">~</span>
                      )}
                    </span>
                  );
                })()}
              </td>
              <td>
                <StatusBadge label={GOREV_DURUM_LABELS[g.durum]} />
              </td>
              <td className="space-y-2">
                {g.durum === "PLANLANDI" && (
                  <form action={gorevBaslat} className="flex flex-col gap-1">
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
                  <form action={gorevKapat} className="flex flex-col gap-1">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="girisTarihi" type="date" defaultValue={today} className={inputCls} />
                    <input name="girisSaati" type="time" className={inputCls} />
                    <input name="kmSayacGiris" type="number" step="0.1" placeholder="KM giriş" className={inputCls} />
                    <select name="durum" defaultValue="TAMAMLANDI" className={inputCls}>
                      <option value="TAMAMLANDI">Tamamlandı</option>
                      <option value="IPTAL_EDILDI">İptal</option>
                    </select>
                    <button className={btnSecondary}>Kapat</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Müdürlük Kullanım Özeti</h2>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Müdürlük</th>
                <th className="p-3">Toplam</th>
                <th className="p-3">Tamamlanan</th>
                <th className="p-3">Devam</th>
                <th className="p-3">Planlanan</th>
                <th className="p-3">İptal</th>
                <th className="p-3">Toplam Süre</th>
              </tr>
            </thead>
            <tbody>
              {mudurlukOzet.map((m) => (
                <tr key={m.id} className="border-b border-kb-border/60">
                  <td className="p-3">{m.name}</td>
                  <td className="p-3">{m.toplam}</td>
                  <td className="p-3">{m.tamamlanan}</td>
                  <td className="p-3">{m.devam}</td>
                  <td className="p-3">{m.planlanan}</td>
                  <td className="p-3">{m.iptal}</td>
                  <td className="p-3">{m.sure.toFixed(1)} sa</td>
                </tr>
              ))}
              <tr className="bg-[#eef2f6] font-semibold">
                <td className="p-3">GENEL TOPLAM</td>
                <td className="p-3">{mudurlukOzet.reduce((s, m) => s + m.toplam, 0)}</td>
                <td className="p-3">{mudurlukOzet.reduce((s, m) => s + m.tamamlanan, 0)}</td>
                <td className="p-3">{mudurlukOzet.reduce((s, m) => s + m.devam, 0)}</td>
                <td className="p-3">{mudurlukOzet.reduce((s, m) => s + m.planlanan, 0)}</td>
                <td className="p-3">{mudurlukOzet.reduce((s, m) => s + m.iptal, 0)}</td>
                <td className="p-3">
                  {mudurlukOzet.reduce((s, m) => s + m.sure, 0).toFixed(1)} sa
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-semibold">Araç Tipi Özeti</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...tipMap.values()].map((t) => (
            <div key={t.name} className={`${cardCls} p-4`}>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-kb-muted mt-1">
                {t.adet} araç · {t.gorev} görev
              </div>
            </div>
          ))}
        </div>
      </section>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / take))}
        basePath="/gorevler"
        searchParams={{ durum: sp.durum, size: sp.size }}
      />
    </div>
  );
}
