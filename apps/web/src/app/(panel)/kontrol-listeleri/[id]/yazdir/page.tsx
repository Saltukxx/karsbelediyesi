import { prisma } from "@kars/db";
import { KONTROL_PERIYOT_LABELS, KONTROL_SONUC_LABELS } from "@kars/shared";
import { notFound } from "next/navigation";
import { YazdirButonu } from "@/components/YazdirButonu";
import { BrandMark } from "@/components/BrandMark";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const PERIYOTLAR = ["HAFTA_1", "HAFTA_2", "HAFTA_3", "HAFTA_4", "AYLIK_BAKIM"] as const;

export default async function KontrolYazdirPage({
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

  return (
    <div className="max-w-5xl mx-auto bg-white text-black p-6 print:p-0">
      <div className="print:hidden mb-4">
        <YazdirButonu />
      </div>
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-kb-navy pb-3">
        <BrandMark />
        <div className="text-right">
          <h1 className="font-brand text-lg font-semibold text-kb-navy">
            {submission.template.ekipmanAdi}
          </h1>
          <p className="text-sm text-kb-muted">Periyodik Bakım Kontrol Formu</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div><strong>Plaka:</strong> {submission.vehicle.plaka}</div>
        <div><strong>Dönem:</strong> {submission.ay}/{submission.yilDonem}</div>
        <div><strong>Operatör/Teknisyen:</strong> {submission.sorumluOperatorTeknisyen ?? "—"}</div>
        <div><strong>Lokasyon:</strong> {submission.santiyeLokasyon ?? "—"}</div>
      </div>
      <table className="w-full text-xs border-collapse mt-4">
        <thead>
          <tr>
            <th className="border p-1 bg-[#eef2f6]">No</th>
            <th className="border p-1 bg-[#eef2f6]">Kontrol Kalemi</th>
            {PERIYOTLAR.map((p) => (
              <th key={p} className="border p-1 bg-[#eef2f6]">{KONTROL_PERIYOT_LABELS[p]}</th>
            ))}
            <th className="border p-1 bg-[#eef2f6]">Not</th>
          </tr>
        </thead>
        <tbody>
          {submission.template.items.map((item) => {
            const notes = PERIYOTLAR.map((p) => resultMap.get(`${item.id}:${p}`)?.aciklamaNot)
              .filter(Boolean)
              .join("; ");
            return (
              <tr key={item.id}>
                <td className="border p-1">{item.siraNo}</td>
                <td className="border p-1">{item.kontrolKalemi}</td>
                {PERIYOTLAR.map((p) => {
                  const r = resultMap.get(`${item.id}:${p}`);
                  return (
                    <td key={p} className="border p-1">
                      {r ? KONTROL_SONUC_LABELS[r.sonuc] : ""}
                    </td>
                  );
                })}
                <td className="border p-1">{notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid grid-cols-3 gap-6 mt-8 text-sm">
        <div>
          <div>Operatör</div>
          <div className="mt-8 border-t border-black pt-1">
            {submission.sorumluOperatorTeknisyen ?? " "}
          </div>
        </div>
        <div>
          <div>Teknisyen</div>
          <div className="mt-8 border-t border-black pt-1">{submission.teknisyenAdi ?? " "}</div>
        </div>
        <div>
          <div>Şef / Amir Onayı</div>
          <div className="mt-8 border-t border-black pt-1">
            {submission.sefAmirAdi ?? submission.onaylayan?.name ?? " "}
          </div>
        </div>
      </div>
    </div>
  );
}
