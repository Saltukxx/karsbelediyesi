import { describe, expect, it } from "vitest";
import { yeniOutboundKey } from "./whatsapp-outbound";

describe("yeniOutboundKey", () => {
  it("produces distinct keys usable as BullMQ jobId", () => {
    const anahtarlar = new Set(Array.from({ length: 500 }, () => yeniOutboundKey()));
    expect(anahtarlar.size).toBe(500);
    for (const k of anahtarlar) {
      expect(k).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
