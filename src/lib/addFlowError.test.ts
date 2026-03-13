import { describe, it, expect } from "vitest";
import { ADD_FLOW_ERROR_PRIMARY, formatAddFlowError } from "./addFlowError";

describe("addFlowError", () => {
  it("returns primary message when given null/undefined", () => {
    expect(formatAddFlowError(null)).toBe(ADD_FLOW_ERROR_PRIMARY);
    expect(formatAddFlowError(undefined)).toBe(ADD_FLOW_ERROR_PRIMARY);
  });

  it("returns primary + detail for safe Error message", () => {
    expect(formatAddFlowError(new Error("duplicate key"))).toBe(
      `${ADD_FLOW_ERROR_PRIMARY} duplicate key`
    );
  });

  it("returns primary only when detail looks like a file path", () => {
    const msg = "/Users/foo/bar.tsx";
    expect(formatAddFlowError(new Error(msg))).toBe(ADD_FLOW_ERROR_PRIMARY);
  });

  it("returns primary only when detail looks like stack trace", () => {
    expect(formatAddFlowError(new Error("at Object.<anonymous> (file.js:1:1)"))).toBe(
      ADD_FLOW_ERROR_PRIMARY
    );
  });

  it("accepts string detail", () => {
    expect(formatAddFlowError("Network timeout")).toBe(
      `${ADD_FLOW_ERROR_PRIMARY} Network timeout`
    );
  });

  it("returns primary only when detail exceeds max length (unsafe)", () => {
    const long = "a".repeat(150);
    expect(formatAddFlowError(new Error(long))).toBe(ADD_FLOW_ERROR_PRIMARY);
  });
});
