import { describe, it, expect } from "vitest";
import type { ReviewImportItem } from "@/lib/reviewImportStorage";
import {
  buildPlantProfileInsertPayload,
  type Zone10bForProfile,
} from "./reviewImportSave";

const mockZone10b: Zone10bForProfile = {
  sun: "Full Sun",
  plant_spacing: "24-36 inches",
  days_to_germination: "7-14 days",
  harvest_days: 85,
  sowing_method: "Start Indoors / Transplant",
  planting_window: "Spring: Feb-May",
};

function minimalItem(overrides: Partial<ReviewImportItem> = {}): ReviewImportItem {
  return {
    id: "item-1",
    imageBase64: "",
    fileName: "",
    vendor: "Test Vendor",
    type: "Tomato",
    variety: "Cherokee Purple",
    tags: ["Heirloom"],
    purchaseDate: "2025-01-15",
    ...overrides,
  };
}

describe("buildPlantProfileInsertPayload", () => {
  it("includes user_id and required profile fields (Law 1)", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem(),
      mockZone10b,
      "user-123",
      () => "2025-01-15"
    );
    expect(payload.user_id).toBe("user-123");
    expect(payload.name).toBe("Tomato");
    expect(payload.variety_name).toBe("Cherokee Purple");
    expect(payload.primary_image_path).toBeNull();
    expect(payload.hero_image_url).toBeDefined();
  });

  it("uses core variety from parseVarietyWithModifiers when variety has modifiers", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ variety: "Cherokee Purple F1 Heirloom" }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.name).toBe("Tomato");
    expect(payload.variety_name).toBe("Cherokee Purple");
    expect(payload.tags).toEqual(["Heirloom"]);
  });

  it("falls back to Unknown when type is empty", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ type: "", variety: "Some Variety" }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.name).toBe("Unknown");
    expect(payload.variety_name).toBe("Some Variety");
  });

  it("merges item research fields with zone10b fallbacks", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({
        sun_requirement: "Partial Shade",
        spacing: "18 inches",
        days_to_germination: "5-10 days",
        days_to_maturity: "75 days",
      }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.sun).toBe("Partial Shade");
    expect(payload.plant_spacing).toBe("18 inches");
    expect(payload.days_to_germination).toBe("5-10 days");
    // zone10b.harvest_days (85) wins when present; item research is fallback when zone10b has none
    expect(payload.harvest_days).toBe(85);
  });

  it("uses item days_to_maturity when zone10b has no harvest_days", () => {
    const zone10bNoHarvest: Zone10bForProfile = { ...mockZone10b, harvest_days: null };
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ days_to_maturity: "75 days" }),
      zone10bNoHarvest,
      "user-1",
      () => ""
    );
    expect(payload.harvest_days).toBe(75);
  });

  it("includes zone10b sowing_method and planting_window when present", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem(),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.sowing_method).toBe("Start Indoors / Transplant");
    expect(payload.planting_window).toBe("Spring: Feb-May");
  });

  it("includes botanical_care_notes when sowing_depth or source_url present", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ sowing_depth: "1/4 inch", source_url: "https://example.com/seed" }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.botanical_care_notes).toEqual({
      sowing_depth: "1/4 inch",
      source_url: "https://example.com/seed",
    });
  });

  it("sets hero_image_url to stock/hero URL when useStockPhotoAsHero is not false", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ hero_image_url: "https://example.com/hero.jpg" }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.hero_image_url).toBe("https://example.com/hero.jpg");
  });

  it("sets hero_image_url to fallback when no stock/hero URL", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem(),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.hero_image_url).toBe("/seedling-icon.svg");
  });

  it("includes plant_description and description_source when present", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ plant_description: "A great tomato." }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.plant_description).toBe("A great tomato.");
    expect(payload.description_source).toBe("vendor");
  });

  it("includes growing_notes when present", () => {
    const payload = buildPlantProfileInsertPayload(
      minimalItem({ growing_notes: "Start indoors 6 weeks before last frost." }),
      mockZone10b,
      "user-1",
      () => ""
    );
    expect(payload.growing_notes).toBe("Start indoors 6 weeks before last frost.");
  });
});
