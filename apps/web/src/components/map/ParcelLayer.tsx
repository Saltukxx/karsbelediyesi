"use client";

import { useState } from "react";
import { Polygon, Popup, Tooltip } from "react-leaflet";
import { format } from "date-fns";
import {
  geometriToLeafletPositions,
  parcelEtiket,
  type ParcelDto,
} from "@/components/map/parcel-api";

const PARCEL_STYLE = {
  color: "#0284c7",
  weight: 2.5,
  fillColor: "#38bdf8",
  fillOpacity: 0.18,
};

function formatAlan(alan: number | null): string | null {
  if (alan == null) return null;
  return `${alan.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m²`;
}

function ParcelPopupContent({
  parcel,
  onRefresh,
  onRemove,
  refreshing,
}: {
  parcel: ParcelDto;
  onRefresh: (parcel: ParcelDto) => void;
  onRemove: (parcel: ParcelDto) => void;
  refreshing: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const alan = formatAlan(parcel.alan);

  async function copyInfo() {
    const text = `${parcel.ilAd} / ${parcel.ilceAd} / ${parcel.mahalleAd} — Ada ${parcel.adaNo}, Parsel ${parcel.parselNo}${alan ? `, ${alan}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pano erişimi engellendi — sessiz geç
    }
  }

  return (
    <div className="max-w-64 space-y-1 text-sm">
      <p className="font-semibold">{parcelEtiket(parcel)}</p>
      <p className="text-xs text-gray-600">
        {parcel.ilAd} / {parcel.ilceAd} / {parcel.mahalleAd}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="pr-2 font-medium">Ada / Parsel</td>
            <td>
              {parcel.adaNo} / {parcel.parselNo}
            </td>
          </tr>
          {alan && (
            <tr>
              <td className="pr-2 font-medium">Alan</td>
              <td>{alan}</td>
            </tr>
          )}
          {parcel.nitelik && (
            <tr>
              <td className="pr-2 font-medium">Nitelik</td>
              <td>{parcel.nitelik}</td>
            </tr>
          )}
          {parcel.mevkii && (
            <tr>
              <td className="pr-2 font-medium">Mevkii</td>
              <td>{parcel.mevkii}</td>
            </tr>
          )}
          {parcel.pafta && (
            <tr>
              <td className="pr-2 font-medium">Pafta</td>
              <td>{parcel.pafta}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-500">
        {parcel.kaynak === "cache" ? "Önbellekten" : "TKGM'den"} —{" "}
        {format(new Date(parcel.sorgulandi), "dd.MM.yyyy HH:mm")}
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={copyInfo}
          className="text-xs font-semibold text-kb-navy hover:underline"
        >
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
        <button
          type="button"
          onClick={() => onRefresh(parcel)}
          disabled={refreshing}
          className="text-xs font-semibold text-kb-navy hover:underline disabled:opacity-50"
        >
          {refreshing ? "Yenileniyor…" : "TKGM'den yenile"}
        </button>
        <button
          type="button"
          onClick={() => onRemove(parcel)}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          Haritadan kaldır
        </button>
      </div>
    </div>
  );
}

export default function ParcelLayer({
  parcels,
  onRefresh,
  onRemove,
  refreshingId,
}: {
  parcels: ParcelDto[];
  onRefresh: (parcel: ParcelDto) => void;
  onRemove: (parcel: ParcelDto) => void;
  refreshingId: string | null;
}) {
  return (
    <>
      {parcels.map((p) => (
        <Polygon
          key={p.id}
          positions={geometriToLeafletPositions(p.geometri)}
          pathOptions={PARCEL_STYLE}
        >
          <Tooltip sticky>{parcelEtiket(p)}</Tooltip>
          <Popup>
            <ParcelPopupContent
              parcel={p}
              onRefresh={onRefresh}
              onRemove={onRemove}
              refreshing={refreshingId === p.id}
            />
          </Popup>
        </Polygon>
      ))}
    </>
  );
}
