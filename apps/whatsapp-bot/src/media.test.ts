import { existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { describe, it, expect, vi } from "vitest";
import {
  extForMime,
  detectInboundMedia,
  downloadAndSaveMedia,
  isPlaceholderIcerik,
  placeholderIcerik,
  MAX_MEDIA_BYTES,
  MEDIA_DIR,
} from "./media";
import { heuristicClassify } from "./classify";

const { downloadMediaMessage } = vi.hoisted(() => ({
  downloadMediaMessage: vi.fn(),
}));

vi.mock("@whiskeysockets/baileys", () => ({ downloadMediaMessage }));

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
        imageMessage: { mimetype: "image/jpeg", fileLength: 1234 },
      }),
    ).toEqual({
      medyaTipi: "image",
      tur: "image",
      mimeType: "image/jpeg",
      fileLength: 1234,
    });
    expect(
      detectInboundMedia({
        audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true },
      }),
    ).toEqual({
      medyaTipi: "audio",
      tur: "audio",
      mimeType: "audio/ogg; codecs=opus",
      fileLength: null,
    });
    expect(detectInboundMedia({ conversation: "merhaba" })).toBeNull();
  });

  it("recognizes unsupported types without a medyaTipi", () => {
    expect(detectInboundMedia({ videoMessage: { mimetype: "video/mp4" } })).toMatchObject(
      { medyaTipi: null, tur: "video" },
    );
    expect(
      detectInboundMedia({ documentMessage: { mimetype: "application/pdf" } }),
    ).toMatchObject({ medyaTipi: null, tur: "document" });
    expect(detectInboundMedia({ stickerMessage: {} })).toMatchObject({
      medyaTipi: null,
      tur: "sticker",
    });
  });
});

describe("downloadAndSaveMedia limits", () => {
  const mesaj = { message: { imageMessage: { mimetype: "image/jpeg" } } };

  it("rejects unsupported types before downloading", async () => {
    await expect(
      downloadAndSaveMedia(mesaj as never, "wa1", {
        medyaTipi: null,
        tur: "video",
        mimeType: "video/mp4",
        fileLength: 100,
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
    expect(downloadMediaMessage).not.toHaveBeenCalled();
  });

  it("rejects oversized media reported by WhatsApp before downloading", async () => {
    await expect(
      downloadAndSaveMedia(mesaj as never, "wa2", {
        medyaTipi: "image",
        tur: "image",
        mimeType: "image/jpeg",
        fileLength: MAX_MEDIA_BYTES + 1,
      }),
    ).rejects.toMatchObject({ code: "too_large" });
    expect(downloadMediaMessage).not.toHaveBeenCalled();
  });

  it("aborts and cleans up when the stream exceeds the limit", async () => {
    const chunk = Buffer.alloc(1024 * 1024);
    const parcalar = Array.from({ length: 10 }, () => chunk);
    downloadMediaMessage.mockResolvedValue(Readable.from(parcalar));

    await expect(
      downloadAndSaveMedia(mesaj as never, "wa3", {
        medyaTipi: "image",
        tur: "image",
        mimeType: "image/jpeg",
        fileLength: null,
      }),
    ).rejects.toMatchObject({ code: "too_large" });

    expect(existsSync(path.join(MEDIA_DIR, "wa3.jpg"))).toBe(false);
  });

  it("treats an empty stream as a failed download", async () => {
    downloadMediaMessage.mockResolvedValue(Readable.from([]));

    await expect(
      downloadAndSaveMedia(mesaj as never, "wa4", {
        medyaTipi: "image",
        tur: "image",
        mimeType: "image/jpeg",
        fileLength: null,
      }),
    ).rejects.toMatchObject({ code: "download_failed" });

    expect(existsSync(path.join(MEDIA_DIR, "wa4.jpg"))).toBe(false);
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
