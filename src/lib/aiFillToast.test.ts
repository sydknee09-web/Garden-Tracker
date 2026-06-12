import { describe, it, expect } from "vitest";
import { aiFillJobToastContent } from "./aiFillToast";

describe("aiFillJobToastContent", () => {
  it("names the plant on a successful fill (brief-locked copy)", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 5, enriched: true, plantName: "Cherokee Purple" });
    expect(r).toEqual({ message: "Cherokee Purple profile updated", variant: "success" });
  });

  it("notFound outranks an incidental fieldsFilled count (B5 honesty preserved)", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 1, notFound: true, plantName: "Cherokee Purple" });
    expect(r.message).toBe("Couldn't find data for Cherokee Purple. Check the spelling of name and variety.");
    expect(r.variant).toBe("error");
  });

  it("quota errors read as AI unavailable", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 0, error: "DAILY_AI_LIMIT", plantName: "Basil" });
    expect(r).toEqual({ message: "Basil: AI unavailable, try again later", variant: "error" });
  });

  it("generic errors read as AI unavailable", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 0, error: "AI_UNREACHABLE", plantName: "Basil" });
    expect(r.variant).toBe("error");
    expect(r.message).toMatch(/AI unavailable/);
  });

  it("enriched=false with nothing filled reads as AI unavailable (honest-feedback contract)", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 0, enriched: false, plantName: "Basil" });
    expect(r).toEqual({ message: "Basil: AI unavailable, try again later", variant: "error" });
  });

  it("clean run with nothing new says so", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 0, enriched: true, plantName: "Basil" });
    expect(r).toEqual({ message: "Basil: nothing new to add", variant: "success" });
  });

  it("falls back to 'Plant' when the subject is empty", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 2 });
    expect(r.message).toBe("Plant profile updated");
  });
});
