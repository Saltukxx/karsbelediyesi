"use client";

import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/lib/ui";
import {
  ilceListesi,
  mahalleListesi,
  parselByAdaParsel,
  parcelEtiket,
  type IdariBirimDto,
  type ParcelDto,
} from "@/components/map/parcel-api";

export default function ParcelSearchPanel({
  active,
  is3D,
  onToggleActive,
  clickLoading,
  clickError,
  parcels,
  onResult,
  onFocus,
  onRemove,
  onClearAll,
}: {
  active: boolean;
  is3D: boolean;
  onToggleActive: () => void;
  clickLoading: boolean;
  clickError: string | null;
  parcels: ParcelDto[];
  onResult: (parcel: ParcelDto) => void;
  onFocus: (parcel: ParcelDto) => void;
  onRemove: (parcel: ParcelDto) => void;
  onClearAll: () => void;
}) {
  const [ilceler, setIlceler] = useState<IdariBirimDto[] | null>(null);
  const [mahalleler, setMahalleler] = useState<IdariBirimDto[] | null>(null);
  const [ilceId, setIlceId] = useState("");
  const [mahalleId, setMahalleId] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [listeLoading, setListeLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ilceler !== null) return;
    let cancelled = false;
    setListeLoading(true);
    ilceListesi()
      .then((items) => {
        if (!cancelled) setIlceler(items);
      })
      .catch(() => {
        if (!cancelled) setError("İlçe listesi alınamadı");
      })
      .finally(() => {
        if (!cancelled) setListeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ilceler]);

  function selectIlce(id: string) {
    setIlceId(id);
    setMahalleId("");
    setMahalleler(null);
    setError(null);
    if (!id) return;
    setListeLoading(true);
    mahalleListesi(Number(id))
      .then(setMahalleler)
      .catch(() => setError("Mahalle listesi alınamadı"))
      .finally(() => setListeLoading(false));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parselTrim = parsel.trim();
    const adaTrim = ada.trim() || "0";
    if (!mahalleId) {
      setError("Mahalle seçin");
      return;
    }
    if (!/^\d+$/.test(parselTrim)) {
      setError("Parsel numarası sayısal olmalı");
      return;
    }
    if (!/^\d+$/.test(adaTrim)) {
      setError("Ada numarası sayısal olmalı");
      return;
    }
    setSearchLoading(true);
    try {
      const result = await parselByAdaParsel(
        Number(mahalleId),
        adaTrim,
        parselTrim,
      );
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sorgu başarısız oldu");
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
        Parsel sorgu (TKGM)
      </p>

      {is3D ? (
        <p className="text-xs text-kb-muted">
          Parsel sorgulamak için 2B görünüme geçin.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggleActive}
            className={
              active
                ? "inline-flex items-center justify-center gap-2 rounded-md bg-kb-navy text-white px-3 py-1.5 text-sm font-semibold"
                : btnSecondary
            }
          >
            {active ? "Tıkla-sorgula açık" : "Haritadan sorgula"}
          </button>
          {active && (
            <p className="mt-2 text-xs text-kb-muted">
              {clickLoading
                ? "Parsel sorgulanıyor…"
                : "Haritada bir noktaya tıklayın, parsel sınırı çizilsin."}
            </p>
          )}
          {clickError && <p className="mt-2 text-xs text-red-600">{clickError}</p>}

          <form onSubmit={handleSearch} className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>İlçe</label>
              <select
                value={ilceId}
                onChange={(e) => selectIlce(e.target.value)}
                className={inputCls}
              >
                <option value="">Seçin…</option>
                {(ilceler ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.ad}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mahalle / Köy</label>
              <select
                value={mahalleId}
                onChange={(e) => {
                  setMahalleId(e.target.value);
                  setError(null);
                }}
                disabled={!mahalleler}
                className={inputCls}
              >
                <option value="">
                  {listeLoading ? "Yükleniyor…" : "Seçin…"}
                </option>
                {(mahalleler ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ad}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelCls}>Ada</label>
                <input
                  value={ada}
                  onChange={(e) => setAda(e.target.value)}
                  inputMode="numeric"
                  placeholder="Boş = 0"
                  className={inputCls}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Parsel *</label>
                <input
                  value={parsel}
                  onChange={(e) => setParsel(e.target.value)}
                  inputMode="numeric"
                  required
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={searchLoading || !mahalleId}
              className={btnPrimary}
            >
              {searchLoading ? "Sorgulanıyor…" : "Bul ve göster"}
            </button>
            {error && (
              <p className="text-xs text-red-600">
                {error}{" "}
                {ilceId && !mahalleler && !listeLoading && (
                  <button
                    type="button"
                    onClick={() => selectIlce(ilceId)}
                    className="font-semibold underline"
                  >
                    Tekrar dene
                  </button>
                )}
              </p>
            )}
          </form>
        </>
      )}

      {parcels.length > 0 && (
        <div className="mt-4 border-t border-kb-border pt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-kb-muted">
              Sorgulanan parseller ({parcels.length})
            </p>
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Temizle
            </button>
          </div>
          <ul className="space-y-1">
            {parcels.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onFocus(p)}
                  className="flex-1 truncate rounded px-2 py-1 text-left text-xs text-kb-ink hover:bg-kb-surface"
                  title={parcelEtiket(p)}
                >
                  {parcelEtiket(p)}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  className="shrink-0 px-1 text-xs text-kb-muted hover:text-red-600"
                  aria-label="Kaldır"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
