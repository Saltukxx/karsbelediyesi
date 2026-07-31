import { describe, expect, it } from "vitest";
import { bekleyenOneriCakismasiMi, oneriAnahtari } from "./dispatch-oneri";

describe("oneriAnahtari", () => {
  it("is unique per route and type", () => {
    expect(oneriAnahtari("TEMIZLIK", "abc")).toBe("TEMIZLIK:abc");
    expect(oneriAnahtari("KIS", "abc")).not.toBe(oneriAnahtari("COP", "abc"));
  });
});

describe("bekleyenOneriCakismasiMi", () => {
  it("detects the unique violation on aktifOneriAnahtari", () => {
    expect(
      bekleyenOneriCakismasiMi({
        code: "P2002",
        meta: { target: ["aktifOneriAnahtari"] },
      }),
    ).toBe(true);
    expect(
      bekleyenOneriCakismasiMi({
        code: "P2002",
        meta: { target: "DispatchJob_aktifOneriAnahtari_key" },
      }),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(bekleyenOneriCakismasiMi(null)).toBe(false);
    expect(bekleyenOneriCakismasiMi(new Error("boom"))).toBe(false);
    expect(
      bekleyenOneriCakismasiMi({ code: "P2002", meta: { target: ["gorevNo"] } }),
    ).toBe(false);
    expect(bekleyenOneriCakismasiMi({ code: "P2025" })).toBe(false);
  });
});
