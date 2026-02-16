import { describe, it, expect } from "vitest";
import { parseFindHeroPhotoResponse } from "./parseFindHeroPhotoResponse";

describe("parseFindHeroPhotoResponse", () => {
  it("returns url when response is valid JSON with hero_image_url", () => {
    const body = JSON.stringify({ hero_image_url: "https://example.com/plant.jpg" });
    const result = parseFindHeroPhotoResponse(body, true);
    expect(result).toEqual({ success: true, url: "https://example.com/plant.jpg" });
  });

  it("returns error from payload when JSON is valid but no http url", () => {
    const body = JSON.stringify({ hero_image_url: "", error: "No images found for this variety" });
    const result = parseFindHeroPhotoResponse(body, true);
    expect(result).toEqual({ success: false, error: "No images found for this variety" });
  });

  it("returns default no-image message when JSON has no url and no error field", () => {
    const body = JSON.stringify({ hero_image_url: "" });
    const result = parseFindHeroPhotoResponse(body, true);
    expect(result).toEqual({ success: false, error: "No image found for this variety." });
  });

  it("returns friendly error (not JSON parse message) when body is invalid JSON and res.ok is false", () => {
    const body = "An error occurred while processing your request.";
    const result = parseFindHeroPhotoResponse(body, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Search timed out or the server returned an error. Please try again.");
      expect(result.error).not.toMatch(/Unexpected token|valid JSON/i);
    }
  });

  it("returns friendly error when body is invalid JSON and res.ok is true", () => {
    const body = "An error occurred";
    const result = parseFindHeroPhotoResponse(body, true);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Search failed. Please try again.");
      expect(result.error).not.toMatch(/Unexpected token|valid JSON/i);
    }
  });

  it("returns friendly error when body is HTML (e.g. 504 page)", () => {
    const body = "<!DOCTYPE html><html><body>Gateway Timeout</body></html>";
    const result = parseFindHeroPhotoResponse(body, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Search timed out or the server returned an error. Please try again.");
    }
  });

  it("ignores non-http hero_image_url", () => {
    const body = JSON.stringify({ hero_image_url: "not-a-url" });
    const result = parseFindHeroPhotoResponse(body, true);
    expect(result).toEqual({ success: false, error: "No image found for this variety." });
  });
});
