export const KARS_CENTER: [number, number] = [40.6013, 43.0975];

export type Basemap = "sokak" | "sade" | "uydu";

export const BASEMAPS: Record<
  Basemap,
  { label: string; url: string; attribution: string }
> = {
  sokak: {
    label: "Sokak",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  sade: {
    label: "Sade",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  uydu: {
    label: "Uydu",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri — World Imagery",
  },
};
