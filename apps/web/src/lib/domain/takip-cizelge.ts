import type {
  DuraklamaDto,
  SapmaDto,
  TakipOlayi,
  VeriBosluguDto,
} from "@/lib/api/track-dto";

/** Çizelge yalnız zaman alanlarını okur; konum ve iz verisi haritaya aittir. */
export interface TakipCizelgeGirdisi {
  rotaGiris: Date | null;
  rotaCikis: Date | null;
  sapmalar: Pick<SapmaDto, "baslangicMs" | "bitisMs" | "sureDk" | "maxMesafeM">[];
  duraklamalar: Pick<
    DuraklamaDto,
    "baslangicMs" | "bitisMs" | "sureDk" | "rotaUzerinde"
  >[];
  bosluklar: Pick<VeriBosluguDto, "baslangicMs" | "bitisMs" | "sureDk">[];
}

/**
 * Görev takip raporunun kronolojik olay listesi. Sıralama tek yerde üretilir ki
 * web sayfası ve mobil ekran aynı çizelgeyi göstersin; etiket ve renk seçimi
 * sunum katmanına bırakılır.
 */
export function takipZamanCizelgesi(girdi: TakipCizelgeGirdisi): TakipOlayi[] {
  const olaylar: TakipOlayi[] = [];

  if (girdi.rotaGiris) {
    olaylar.push(anlikOlay("ROTA_GIRIS", girdi.rotaGiris));
  }
  for (const s of girdi.sapmalar) {
    olaylar.push({
      tip: "SAPMA",
      baslangicMs: s.baslangicMs,
      bitisMs: s.bitisMs,
      sureDk: s.sureDk,
      maxMesafeM: s.maxMesafeM,
    });
  }
  for (const d of girdi.duraklamalar) {
    olaylar.push({
      tip: d.rotaUzerinde ? "DURAKLAMA_ROTADA" : "DURAKLAMA_ROTA_DISI",
      baslangicMs: d.baslangicMs,
      bitisMs: d.bitisMs,
      sureDk: d.sureDk,
      maxMesafeM: null,
    });
  }
  for (const b of girdi.bosluklar) {
    olaylar.push({
      tip: "VERI_BOSLUGU",
      baslangicMs: b.baslangicMs,
      bitisMs: b.bitisMs,
      sureDk: b.sureDk,
      maxMesafeM: null,
    });
  }
  if (girdi.rotaCikis) {
    olaylar.push(anlikOlay("ROTA_CIKIS", girdi.rotaCikis));
  }

  return olaylar.sort((a, b) => a.baslangicMs - b.baslangicMs);
}

function anlikOlay(tip: TakipOlayi["tip"], an: Date): TakipOlayi {
  return {
    tip,
    baslangicMs: an.getTime(),
    bitisMs: null,
    sureDk: null,
    maxMesafeM: null,
  };
}
