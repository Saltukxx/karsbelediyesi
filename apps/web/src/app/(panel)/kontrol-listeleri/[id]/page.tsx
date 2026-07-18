import { prisma } from "@kars/db";
import { KONTROL_PERIYOT_LABELS, KONTROL_SONUC_LABELS } from "@kars/shared";
import {
  kontrolKalemKaydet,
  kontrolFormuOnayaGonder,
  kontrolFormuOnayla,
} from "@/lib/actions/checklists";
import { inputCls, btnPrimary, btnSecondary, cardCls } from "@/lib/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const PERIYOTLAR = ["HAFTA_1", "HAFTA_2", "HAFTA_3", "HAFTA_4", "AYLIK_BAKIM"] as const;

export default async function KontrolFormDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("/kontrol-listeleri");
  const { id } = await params;
  const submission = await prisma.checklistSubmission.findUnique({
    where: { id },
    include: {
      template: { include: { items: { where: { aktif: true }, orderBy: { siraNo: "asc" } } } },
      vehicle: true,
      results: true,
      onaylayan: true,
    },
  });
  if (!submission) notFound();

  const resultMap = new Map(
    submission.results.map((r) => [`${r.templateItemId}:${r.periyot}`, r]),
  );

  const byKategori = new Map<string, typeof submission.template.items>();
  for (const item of submission.template.items) {
    const list = byKategori.get(item.kategori) ?? [];
    list.push(item);
    byKategori.set(item.kategori, list);
  }

  const editable = submission.durum === "TASLAK" || submission.durum === "ONAY_BEKLIYOR";

  return (
    <div className="space-y-4">
      <PageHeader
        title={submission.template.ekipmanAdi}
        description={`${submission.vehicle.plaka} · ${submission.ay}/${submission.yilDonem} · ${submission.santiyeLokasyon ?? "—"}`}
        actions={
          <>
            <StatusBadge label={submission.durum.replaceAll("_", " ")} />
            <Link href="/kontrol-listeleri" className="text-sm text-kb-muted hover:text-kb-ink">
              ← Liste
            </Link>
            <Link
              href={`/kontrol-listeleri/${id}/yazdir`}
              className={btnSecondary}
              target="_blank"
            >
              PDF / Yazdır
            </Link>
          </>
        }
      />

      {[...byKategori.entries()].map(([kategori, items]) => (
        <section key={kategori} className={`${cardCls} overflow-x-auto`}>
          <div className="p-3 border-b bg-[#eef2f6] font-medium">
            {kategori}
          </div>
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="text-left text-kb-muted border-b">
                <th className="p-2 w-10">No</th>
                <th className="p-2 min-w-[200px]">Kontrol Kalemi</th>
                {PERIYOTLAR.map((p) => (
                  <th key={p} className="p-2">{KONTROL_PERIYOT_LABELS[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-kb-border/60 align-top">
                  <td className="p-2 text-kb-muted">{item.siraNo}</td>
                  <td className="p-2">{item.kontrolKalemi}</td>
                  {PERIYOTLAR.map((periyot) => {
                    const existing = resultMap.get(`${item.id}:${periyot}`);
                    return (
                      <td key={periyot} className="p-2">
                        {editable ? (
                          <form action={kontrolKalemKaydet} className="space-y-1">
                            <input type="hidden" name="submissionId" value={id} />
                            <input type="hidden" name="templateItemId" value={item.id} />
                            <input type="hidden" name="periyot" value={periyot} />
                            <select
                              name="sonuc"
                              defaultValue={existing?.sonuc ?? "UYGUN"}
                              className={inputCls}
                            >
                              {Object.entries(KONTROL_SONUC_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                            <input
                              name="aciklamaNot"
                              defaultValue={existing?.aciklamaNot ?? ""}
                              placeholder="Not"
                              className={inputCls}
                            />
                            <button className={btnSecondary}>Kaydet</button>
                          </form>
                        ) : (
                          <div className="">
                            {existing ? KONTROL_SONUC_LABELS[existing.sonuc] : "—"}
                            {existing?.aciklamaNot && (
                              <div className="text-kb-muted mt-1">{existing.aciklamaNot}</div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {submission.durum === "TASLAK" && (
        <form action={kontrolFormuOnayaGonder} className={`${cardCls} p-4 grid md:grid-cols-3 gap-3 items-end`}>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="text-xs text-kb-muted block mb-1">Teknisyen Adı</label>
            <input name="teknisyenAdi" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şef / Amir</label>
            <input name="sefAmirAdi" className={inputCls} />
          </div>
          <button className={btnPrimary}>Onaya Gönder</button>
        </form>
      )}

      {submission.durum === "ONAY_BEKLIYOR" && (
        <form action={kontrolFormuOnayla} className={`${cardCls} p-4 flex flex-wrap gap-3 items-end`}>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şef / Amir</label>
            <input name="sefAmirAdi" className={inputCls} />
          </div>
          <button name="karar" value="ONAYLANDI" className={btnPrimary}>Onayla</button>
          <button name="karar" value="REDDEDILDI" className={btnSecondary}>Reddet</button>
        </form>
      )}

      {submission.onayTarihi && (
        <p className="text-sm text-kb-muted">
          Onay: {submission.onaylayan?.name ?? submission.sefAmirAdi} ·{" "}
          {submission.onayTarihi.toLocaleDateString("tr-TR")}
        </p>
      )}
    </div>
  );
}
