import { describe, expect, it } from "vitest";
import { geocodeSorguMetni } from "./geocode";

describe("geocodeSorguMetni", () => {
  it("adres ve mahalleyi Kars ile birleştirir", () => {
    expect(
      geocodeSorguMetni({
        adres: "Atatürk Cad. No:12",
        mahalle: "Yenişehir",
      }),
    ).toBe("Atatürk Cad. No:12, Yenişehir, Kars");
  });

  it("yalnız mahalle ile çalışır", () => {
    expect(geocodeSorguMetni({ mahalle: "Ortakapı" })).toBe("Ortakapı, Kars");
  });

  it("boş girdide null döner", () => {
    expect(geocodeSorguMetni({})).toBeNull();
    expect(geocodeSorguMetni({ adres: "  ", mahalle: "" })).toBeNull();
  });
});
