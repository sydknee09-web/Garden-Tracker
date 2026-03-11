import { describe, it, expect } from "vitest";
import { parseSeedFromQR } from "./parseSeedFromQR";

describe("parseSeedFromQR", () => {
  it("returns empty object for empty string", () => {
    expect(parseSeedFromQR("")).toEqual({});
  });

  it("returns empty object for whitespace-only string", () => {
    expect(parseSeedFromQR("   ")).toEqual({});
  });

  it("parses URL query params", () => {
    const result = parseSeedFromQR("https://example.com/seed?name=Tomato&variety=Cherokee+Purple&vendor=Baker+Creek&harvest_days=80");
    expect(result.name).toBe("Tomato");
    expect(result.variety).toBe("Cherokee Purple");
    expect(result.vendor).toBe("Baker Creek");
    expect(result.harvest_days).toBe("80");
  });

  it("parses URL with only name param", () => {
    const result = parseSeedFromQR("https://example.com/seed?name=Basil");
    expect(result.name).toBe("Basil");
    expect(result.variety).toBeUndefined();
    expect(result.vendor).toBeUndefined();
  });

  it("parses JSON payload", () => {
    const json = JSON.stringify({ name: "Pepper", variety: "Jalapeño", vendor: "Burpee", harvest_days: 70 });
    const result = parseSeedFromQR(json);
    expect(result.name).toBe("Pepper");
    expect(result.variety).toBe("Jalapeño");
    expect(result.vendor).toBe("Burpee");
    expect(result.harvest_days).toBe("70");
  });

  it("parses JSON with harvest_days as string", () => {
    const json = JSON.stringify({ name: "Corn", harvest_days: "75-90" });
    const result = parseSeedFromQR(json);
    expect(result.harvest_days).toBe("75-90");
  });

  it("returns empty object for invalid JSON non-URL text", () => {
    expect(parseSeedFromQR("not valid json or url")).toEqual({});
  });

  it("returns empty object for malformed URL (caught exception)", () => {
    // This is not a URL and not valid JSON
    expect(parseSeedFromQR(":::bad:::")).toEqual({});
  });

  it("ignores non-string fields in JSON", () => {
    const json = JSON.stringify({ name: 42, variety: null });
    const result = parseSeedFromQR(json);
    expect(result.name).toBeUndefined();
    expect(result.variety).toBeUndefined();
  });

  it("handles http:// URLs (not just https://)", () => {
    const result = parseSeedFromQR("http://example.com/?name=Bean");
    expect(result.name).toBe("Bean");
  });

  it("trims the input before processing", () => {
    const json = "  " + JSON.stringify({ name: "Kale" }) + "  ";
    const result = parseSeedFromQR(json);
    expect(result.name).toBe("Kale");
  });
});
