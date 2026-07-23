import * as L from "leaflet";

/**
 * leaflet.heat UMD değildir; global `L` bekler ve üzerine HeatLayer/heatLayer ekler.
 * ESM namespace nesnesi dondurulmuş olduğundan yazılabilir bir türev nesne yayınlıyoruz.
 * Bu modül, "leaflet.heat" import'undan ÖNCE değerlendirilmelidir
 * (HeatLayer.tsx'teki import sırası bu yüzden önemli).
 */
type MutableL = typeof L & { heatLayer?: typeof L.heatLayer };

const globalL: MutableL = Object.create(L) as MutableL;
(globalThis as { L?: MutableL }).L = globalL;

export function heatLayerFactory(): typeof L.heatLayer {
  if (typeof globalL.heatLayer !== "function") {
    throw new Error("leaflet.heat yüklenemedi (global L bulunamadı)");
  }
  return globalL.heatLayer;
}
