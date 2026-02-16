import { describe, it, expect } from "vitest";
import { parseFindHeroPhotoResponse, parseFindHeroPhotoGalleryResponse } from "./parseFindHeroPhotoResponse";

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

describe("parseFindHeroPhotoGalleryResponse", () => {
  it("returns urls when response is valid JSON with urls array", () => {
    const body = JSON.stringify({ urls: ["https://a.com/1.jpg", "https://b.com/2.png"] });
    const result = parseFindHeroPhotoGalleryResponse(body, true);
    expect(result).toEqual({ success: true, urls: ["https://a.com/1.jpg", "https://b.com/2.png"] });
  });

  it("filters out non-http entries and returns success when at least one url", () => {
    const body = JSON.stringify({ urls: ["https://ok.com/x.jpg", "not-a-url", "ftp://old.com/y.gif"] });
    const result = parseFindHeroPhotoGalleryResponse(body, true);
    expect(result).toEqual({ success: true, urls: ["https://ok.com/x.jpg"] });
  });

  it("returns error when urls is empty and error field present", () => {
    const body = JSON.stringify({ urls: [], error: "Search took too long. Please try again." });
    const result = parseFindHeroPhotoGalleryResponse(body, true);
    expect(result).toEqual({ success: false, error: "Search took too long. Please try again." });
  });

  it("returns friendly error when body is invalid JSON", () => {
    const result = parseFindHeroPhotoGalleryResponse("<html/>", false);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/Unexpected token|valid JSON/i);
  });
});
