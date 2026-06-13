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

  it("partial fill names what's missing without reading as an error (Finding #41)", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 12, enriched: true, partial: true, plantName: "Finger Lime" });
    expect(r.variant).toBe("success");
    expect(r.message).toBe("Finger Lime: filled 12 fields — some details unavailable, tap Fill blanks to retry");
  });

  it("partial fill uses singular 'field' for a count of 1", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 1, enriched: true, partial: true, plantName: "Finger Lime" });
    expect(r.message).toBe("Finger Lime: filled 1 field — some details unavailable, tap Fill blanks to retry");
  });

  it("partial is ignored when nothing was filled (notFound / nothing-new copy wins)", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 0, enriched: true, partial: true, plantName: "Basil" });
    expect(r).toEqual({ message: "Basil: nothing new to add", variant: "success" });
  });

  it("notFound still outranks partial", () => {
    const r = aiFillJobToastContent({ fieldsFilled: 3, notFound: true, partial: true, plantName: "Basil" });
    expect(r.variant).toBe("error");
    expect(r.message).toMatch(/Couldn't find data/);
  });
});
