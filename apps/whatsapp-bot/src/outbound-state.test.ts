import { describe, it, expect } from "vitest";
import { sonDenemeMi } from "./outbound-state";

describe("sonDenemeMi", () => {
  it("tek denemeli job ilk çalıştırmada son denemedir", () => {
    expect(sonDenemeMi({ attemptsMade: 0, opts: { attempts: 1 } })).toBe(true);
  });

  it("deneme hakkı kalanlar son deneme sayılmaz", () => {
    expect(sonDenemeMi({ attemptsMade: 0, opts: { attempts: 10 } })).toBe(false);
    expect(sonDenemeMi({ attemptsMade: 8, opts: { attempts: 10 } })).toBe(false);
  });

  it("son hak kullanılırken true döner", () => {
    expect(sonDenemeMi({ attemptsMade: 9, opts: { attempts: 10 } })).toBe(true);
  });

  it("attempts verilmezse tek deneme varsayılır", () => {
    expect(sonDenemeMi({ attemptsMade: 0, opts: {} })).toBe(true);
  });
});
