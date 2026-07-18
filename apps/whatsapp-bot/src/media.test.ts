import { describe, it, expect } from "vitest";
import {
  extForMime,
  detectInboundMedia,
  isPlaceholderIcerik,
  placeholderIcerik,
} from "./media";
import { heuristicClassify } from "./classify";

describe("extForMime", () => {
  it("maps common image and audio types", () => {
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extForMime("audio/mpeg")).toBe("mp3");
  });
});

describe("detectInboundMedia", () => {
  it("detects image and audio", () => {
    expect(
      detectInboundMedia({
        imageMessage: { mimetype: "image/jpeg" },
      }),
    ).toEqual({ medyaTipi: "image", mimeType: "image/jpeg" });
    expect(
      detectInboundMedia({
        audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true },
      }),
    ).toEqual({
      medyaTipi: "audio",
      mimeType: "audio/ogg; codecs=opus",
    });
    expect(detectInboundMedia({ conversation: "merhaba" })).toBeNull();
  });
});

describe("placeholders", () => {
  it("recognizes media placeholders", () => {
    expect(placeholderIcerik("image")).toBe("(fotoğraf)");
    expect(placeholderIcerik("audio")).toBe("(sesli mesaj)");
    expect(isPlaceholderIcerik("(fotoğraf)")).toBe(true);
    expect(isPlaceholderIcerik("(sesli mesaj)")).toBe(true);
    expect(isPlaceholderIcerik("Yenişehir su")).toBe(false);
  });
});

describe("heuristicClassify media-only", () => {
  it("routes media-only messages to low-confidence complaint for operators", () => {
    const r = heuristicClassify("(fotoğraf)", true);
    expect(r.intent).toBe("sikayet");
    expect(r.guven).toBeLessThan(0.75);
    expect(r.mahalle).toBeNull();
  });
});
