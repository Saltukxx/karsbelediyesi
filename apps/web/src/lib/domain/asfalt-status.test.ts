import { describe, expect, it } from "vitest";
import { canTransitionAsfalt } from "./asfalt-status";

describe("canTransitionAsfalt", () => {
  it("allows forward progress for field workers", () => {
    expect(canTransitionAsfalt("PLANLANDI", "DEVAM_EDIYOR", "FIELD_WORKER").ok).toBe(true);
    expect(canTransitionAsfalt("DEVAM_EDIYOR", "TAMAMLANDI", "FIELD_WORKER").ok).toBe(true);
  });

  it("treats no-op transitions as valid", () => {
    expect(canTransitionAsfalt("TAMAMLANDI", "TAMAMLANDI", "FIELD_WORKER").ok).toBe(true);
  });

  it("blocks field workers from reopening a completed road", () => {
    const sonuc = canTransitionAsfalt("TAMAMLANDI", "DEVAM_EDIYOR", "FIELD_WORKER");
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.error).toContain("yeniden açılamaz");
  });

  it("lets admins and managers reopen a completed road", () => {
    expect(canTransitionAsfalt("TAMAMLANDI", "DEVAM_EDIYOR", "ADMIN").ok).toBe(true);
    expect(canTransitionAsfalt("TAMAMLANDI", "DEVAM_EDIYOR", "DEPARTMENT_MANAGER").ok).toBe(
      true,
    );
  });

  it("rejects skipping from completed straight back to planning", () => {
    expect(canTransitionAsfalt("TAMAMLANDI", "PLANLANDI", "ADMIN").ok).toBe(false);
  });
});
