import { describe, expect, it } from "vitest";
import { takipZamanCizelgesi } from "./takip-cizelge";

const BOS = {
  rotaGiris: null,
  rotaCikis: null,
  sapmalar: [],
  duraklamalar: [],
  bosluklar: [],
};

describe("takipZamanCizelgesi", () => {
  it("veri yokken boş çizelge döner", () => {
    expect(takipZamanCizelgesi(BOS)).toEqual([]);
  });

  it("olayları başlangıç zamanına göre sıralar", () => {
    const cizelge = takipZamanCizelgesi({
      ...BOS,
      rotaGiris: new Date(1_000),
      rotaCikis: new Date(9_000),
      sapmalar: [{ baslangicMs: 5_000, bitisMs: 6_000, sureDk: 1, maxMesafeM: 120 }],
      duraklamalar: [
        { baslangicMs: 3_000, bitisMs: 4_000, sureDk: 2, rotaUzerinde: true },
        { baslangicMs: 7_000, bitisMs: 8_000, sureDk: 3, rotaUzerinde: false },
      ],
      bosluklar: [{ baslangicMs: 2_000, bitisMs: 2_500, sureDk: 1 }],
    });

    expect(cizelge.map((o) => o.tip)).toEqual([
      "ROTA_GIRIS",
      "VERI_BOSLUGU",
      "DURAKLAMA_ROTADA",
      "SAPMA",
      "DURAKLAMA_ROTA_DISI",
      "ROTA_CIKIS",
    ]);
  });

  it("rota giriş/çıkışını anlık olay olarak yazar", () => {
    const cizelge = takipZamanCizelgesi({ ...BOS, rotaGiris: new Date(1_500) });
    expect(cizelge).toEqual([
      {
        tip: "ROTA_GIRIS",
        baslangicMs: 1_500,
        bitisMs: null,
        sureDk: null,
        maxMesafeM: null,
      },
    ]);
  });

  it("sapmanın maksimum mesafesini korur, duraklamada boş bırakır", () => {
    const cizelge = takipZamanCizelgesi({
      ...BOS,
      sapmalar: [{ baslangicMs: 10, bitisMs: 20, sureDk: 1, maxMesafeM: 240 }],
      duraklamalar: [{ baslangicMs: 30, bitisMs: 40, sureDk: 1, rotaUzerinde: false }],
    });

    expect(cizelge[0].maxMesafeM).toBe(240);
    expect(cizelge[1].maxMesafeM).toBeNull();
  });

  it("rota üzeri ve rota dışı duraklamayı ayrı tiplere ayırır", () => {
    const cizelge = takipZamanCizelgesi({
      ...BOS,
      duraklamalar: [
        { baslangicMs: 10, bitisMs: 20, sureDk: 1, rotaUzerinde: true },
        { baslangicMs: 30, bitisMs: 40, sureDk: 1, rotaUzerinde: false },
      ],
    });

    expect(cizelge.map((o) => o.tip)).toEqual([
      "DURAKLAMA_ROTADA",
      "DURAKLAMA_ROTA_DISI",
    ]);
  });
});
