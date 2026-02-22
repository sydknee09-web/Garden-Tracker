import { describe, it, expect } from "vitest";
import { buildProfileInsertFromName } from "./buildProfileInsertFromName";

describe("buildProfileInsertFromName", () => {
  it("includes user_id and required profile fields (Law 1)", () => {
    const payload = buildProfileInsertFromName("Tomato", "Cherokee Purple", "user-123");
    expect(payload.user_id).toBe("user-123");
    expect(payload.name).toBe("Tomato");
    expect(payload.variety_name).toBe("Cherokee Purple");
    expect(payload.profile_type).toBe("seed");
    expect(payload.status).toBe("active");
  });

  it("maps profileType correctly: permanent and seed", () => {
    const seedPayload = buildProfileInsertFromName("Rose", "Cecile Brunner", "user-1", {
      profileType: "seed",
    });
    expect(seedPayload.profile_type).toBe("seed");

    const permPayload = buildProfileInsertFromName("Avocado", "Hass", "user-1", {
      profileType: "permanent",
    });
    expect(permPayload.profile_type).toBe("permanent");
  });

  it("uses coreVariety from parseVarietyWithModifiers and extracts modifier tags", () => {
    const payload = buildProfileInsertFromName("Beet", "Bulls Blood F1 Organic", "user-1");
    expect(payload.variety_name).toBe("Bulls Blood");
    expect(payload.tags).toContain("F1");
    expect(payload.tags).toContain("Organic");
  });

  it("adds 11 functional tags from name+variety text", () => {
    const payload = buildProfileInsertFromName("Sunflower", "Pollinator Mix", "user-1");
    expect(payload.tags).toContain("Pollinator");
  });

  it("filters blocked tags when provided", () => {
    const blocked = new Set(["F1"]);
    const payload = buildProfileInsertFromName("Beet", "Bulls Blood F1", "user-1", {
      blockedTags: blocked,
    });
    expect(payload.tags ?? []).not.toContain("F1");
    expect(payload.variety_name).toBe("Bulls Blood");
  });

  it("uses custom status", () => {
    const payload = buildProfileInsertFromName("Tomato", "Roma", "user-1", {
      status: "out_of_stock",
    });
    expect(payload.status).toBe("out_of_stock");
  });

  it("handles empty variety", () => {
    const payload = buildProfileInsertFromName("Lettuce", "", "user-1");
    expect(payload.variety_name).toBeNull();
    expect(payload.name).toBe("Lettuce");
  });

  it("handles null variety", () => {
    const payload = buildProfileInsertFromName("Basil", null, "user-1");
    expect(payload.variety_name).toBeNull();
  });
});
