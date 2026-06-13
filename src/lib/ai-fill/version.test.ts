import { describe, it, expect } from "vitest";
import { CURRENT_AI_FILL_VERSION, isFieldFillEligible } from "./version";

describe("isFieldFillEligible — version-aware Fill Blanks semantics", () => {
  const LEGACY = 0;
  const CURRENT = CURRENT_AI_FILL_VERSION;

  it("blank field always fills (the original Fill-Blanks behavior)", () => {
    expect(isFieldFillEligible({ overwrite: false, blank: true, profileVersion: CURRENT, fieldHasProvenance: false })).toBe(true);
    expect(isFieldFillEligible({ overwrite: false, blank: true, profileVersion: LEGACY, fieldHasProvenance: false })).toBe(true);
  });

  it("Overwrite button writes any field regardless of version or provenance", () => {
    expect(isFieldFillEligible({ overwrite: true, blank: false, profileVersion: CURRENT, fieldHasProvenance: false })).toBe(true);
    expect(isFieldFillEligible({ overwrite: true, blank: false, profileVersion: LEGACY, fieldHasProvenance: false })).toBe(true);
  });

  it("LEGACY + Fill Blanks: re-fills a non-blank AI-owned field (self-heal)", () => {
    // The Finding #39 fix: stale AI data on a legacy profile gets refreshed instead of skipped.
    expect(
      isFieldFillEligible({ overwrite: false, blank: false, profileVersion: LEGACY, fieldHasProvenance: true })
    ).toBe(true);
  });

  it("CURRENT + Fill Blanks: preserves a non-blank field even if AI-owned (blanks-only)", () => {
    expect(
      isFieldFillEligible({ overwrite: false, blank: false, profileVersion: CURRENT, fieldHasProvenance: true })
    ).toBe(false);
  });

  it("item-6 invariant: a non-blank field with NO provenance is NEVER overwritten by Fill Blanks", () => {
    // User-typed / vendor / pre-Ship-2 legacy fields have no provenance entry → protected,
    // on BOTH legacy and current profiles. Only the explicit Overwrite button may touch them.
    expect(isFieldFillEligible({ overwrite: false, blank: false, profileVersion: LEGACY, fieldHasProvenance: false })).toBe(false);
    expect(isFieldFillEligible({ overwrite: false, blank: false, profileVersion: CURRENT, fieldHasProvenance: false })).toBe(false);
  });

  it("a version BELOW current but above legacy is still treated as legacy (self-heals)", () => {
    // Guards the < comparison if CURRENT is ever bumped past 1.
    if (CURRENT > 1) {
      expect(
        isFieldFillEligible({ overwrite: false, blank: false, profileVersion: CURRENT - 1, fieldHasProvenance: true })
      ).toBe(true);
    } else {
      expect(CURRENT).toBe(1);
    }
  });
});
