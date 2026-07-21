"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/DataTable";
import { formatLength, roadLengthMeters } from "@/components/map/road-map-geo";
import {
  ASFALT_DURUM_LABELS,
  HAZARD_TIP_LABELS,
  type ComplaintPinDto,
  type HazardDto,
  type RoadDto,
} from "@/components/map/road-map-types";

type TabId = "yollar" | "engeller" | "sikayetler";

const ASFALT_BADGE: Record<RoadDto["durum"], string> = {
  TAMAMLANDI: "bg-green-100 text-green-800",
  DEVAM_EDIYOR: "bg-amber-100 text-amber-800",
  PLANLANDI: "bg-slate-100 text-slate-700",
};

function badge(cls: string, label: string) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function RoadMapTables({
  roads,
  hazards,
  complaints,
  canEdit,
  pending,
  onFocusRoad,
  onEditRoad,
  onDeleteRoad,
  onFocusHazard,
  onToggleHazard,
  onDeleteHazard,
  onFocusComplaint,
}: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
  canEdit: boolean;
  pending: boolean;
  onFocusRoad: (r: RoadDto) => void;
  onEditRoad: (r: RoadDto) => void;
  onDeleteRoad: (id: string) => void;
  onFocusHazard: (h: HazardDto) => void;
  onToggleHazard: (h: HazardDto) => void;
  onDeleteHazard: (id: string) => void;
  onFocusComplaint: (c: ComplaintPinDto) => void;
}) {
  const [tab, setTab] = useState<TabId>("yollar");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "yollar", label: `Asfalt yollar (${roads.length})` },
    { id: "engeller", label: `Çukur / engeller (${hazards.length})` },
    { id: "sikayetler", label: `Şikayetler (${complaints.length})` },
  ];

  const linkBtn = "text-xs font-semibold text-kb-navy hover:underline disabled:opacity-50";
  const dangerBtn = "text-xs font-semibold text-red-600 hover:underline disabled:opacity-50";

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap gap-1 border-b border-kb-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border border-b-0 border-kb-border bg-white text-kb-navy"
                : "text-kb-muted hover:text-kb-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === "yollar" && (
          <DataTable
            empty={roads.length === 0}
            emptyTitle="Kayıtlı yol yok"
            emptyDescription='Haritadan "Yol çiz" ile ilk asfalt kaydını ekleyin.'
          >
            <thead>
              <tr>
                <th>Yol adı</th>
                <th>Durum</th>
                <th>Uzunluk</th>
                <th>Döküm tarihi</th>
                <th>Ekleyen</th>
                <th>Notlar</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {roads.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.ad}</td>
                  <td>{badge(ASFALT_BADGE[r.durum], ASFALT_DURUM_LABELS[r.durum])}</td>
                  <td>{formatLength(roadLengthMeters(r.koordinatlar))}</td>
                  <td>
                    {r.dokumTarihi ? format(new Date(r.dokumTarihi), "dd.MM.yyyy") : "—"}
                  </td>
                  <td>{r.olusturan}</td>
                  <td className="max-w-56 truncate" title={r.notlar ?? undefined}>
                    {r.notlar ?? "—"}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => onFocusRoad(r)} className={linkBtn}>
                        Haritada göster
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditRoad(r)}
                            disabled={pending}
                            className={linkBtn}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRoad(r.id)}
                            disabled={pending}
                            className={dangerBtn}
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {tab === "engeller" && (
          <DataTable
            empty={hazards.length === 0}
            emptyTitle="Kayıtlı çukur / engel yok"
            emptyDescription='Haritadan "Çukur / engel ekle" ile ilk noktayı işaretleyin.'
          >
            <thead>
              <tr>
                <th>Tip</th>
                <th>Durum</th>
                <th>Açıklama</th>
                <th>Fotoğraf</th>
                <th>Ekleyen</th>
                <th>Tarih</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {hazards.map((h) => (
                <tr key={h.id}>
                  <td className="font-medium">{HAZARD_TIP_LABELS[h.tip]}</td>
                  <td>
                    {h.durum === "ACIK"
                      ? badge("bg-red-100 text-red-800", "Açık")
                      : badge("bg-green-100 text-green-800", "Giderildi")}
                  </td>
                  <td className="max-w-56 truncate" title={h.aciklama ?? undefined}>
                    {h.aciklama ?? "—"}
                  </td>
                  <td>
                    {h.photoIds.length > 0 ? (
                      <div className="flex gap-1">
                        {h.photoIds.slice(0, 3).map((pid) => (
                          <a
                            key={pid}
                            href={`/api/ops/hazard-photo/${pid}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/ops/hazard-photo/${pid}`}
                              alt="Fotoğraf"
                              className="h-9 w-9 rounded object-cover"
                            />
                          </a>
                        ))}
                        {h.photoIds.length > 3 && (
                          <span className="self-center text-xs text-kb-muted">
                            +{h.photoIds.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{h.olusturan}</td>
                  <td>{format(new Date(h.tarih), "dd.MM.yyyy HH:mm")}</td>
                  <td>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => onFocusHazard(h)} className={linkBtn}>
                        Haritada göster
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => onToggleHazard(h)}
                            disabled={pending}
                            className={linkBtn}
                          >
                            {h.durum === "ACIK" ? "Giderildi işaretle" : "Tekrar aç"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteHazard(h.id)}
                            disabled={pending}
                            className={dangerBtn}
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {tab === "sikayetler" && (
          <DataTable
            empty={complaints.length === 0}
            emptyTitle="Konumu bilinen şikayet yok"
            emptyDescription="Sadece lat/lng bilgisi olan şikayetler haritada gösterilir."
          >
            <thead>
              <tr>
                <th>Şikayet No</th>
                <th>Durum</th>
                <th>Açıklama</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.sikayetNo}</td>
                  <td>{c.durum}</td>
                  <td className="max-w-72 truncate" title={c.aciklama ?? undefined}>
                    {c.aciklama ?? "—"}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => onFocusComplaint(c)}
                        className={linkBtn}
                      >
                        Haritada göster
                      </button>
                      <Link href={`/sikayetler/${c.id}`} className={linkBtn}>
                        Detay
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
