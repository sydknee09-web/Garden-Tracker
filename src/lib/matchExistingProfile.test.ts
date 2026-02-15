import { describe, it, expect } from "vitest";
import { findExistingProfileByCanonical, type ProfileForMatch } from "./matchExistingProfile";

const baseProfiles: ProfileForMatch[] = [
  { id: "1", name: "Cucumber", variety_name: "Dragon's Egg" },
  { id: "2", name: "Tomato", variety_name: "Cherokee Purple" },
  { id: "3", name: "Cosmos", variety_name: "Double Dutch" },
  { id: "4", name: "Bean", variety_name: null },
  { id: "5", name: "Eschscholzia", variety_name: "californica" },
];

describe("findExistingProfileByCanonical", () => {
  it("matches exact name and variety", () => {
    const found = findExistingProfileByCanonical(baseProfiles, "Cucumber", "Dragon's Egg");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1");
    expect(found!.name).toBe("Cucumber");
    expect(found!.variety_name).toBe("Dragon's Egg");
  });

  it("matches canonical name/variety (punctuation and case ignored)", () => {
    const found = findExistingProfileByCanonical(baseProfiles, "cucumber", "Dragons Egg");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1");
  });

  it("matches when variety has modifiers stripped (e.g. F1)", () => {
    // "Dragon's Egg F1" -> coreVariety "Dragon's Egg" -> canonical matches
    const found = findExistingProfileByCanonical(baseProfiles, "Cucumber", "Dragon's Egg F1");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1");
  });

  it("returns null when no profile matches name+variety", () => {
    expect(findExistingProfileByCanonical(baseProfiles, "Cucumber", "Lemon")).toBeNull();
    expect(findExistingProfileByCanonical(baseProfiles, "Squash", "Dragon's Egg")).toBeNull();
  });

  it("returns null for empty profiles", () => {
    expect(findExistingProfileByCanonical([], "Cucumber", "Dragon's Egg")).toBeNull();
  });

  it("matches profile with null variety when given empty variety", () => {
    const found = findExistingProfileByCanonical(baseProfiles, "Bean", null);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("4");
    expect(found!.variety_name).toBeNull();
  });

  it("uses Unknown when plant name is empty", () => {
    const profilesWithUnknown: ProfileForMatch[] = [
      { id: "u", name: "Unknown", variety_name: "" },
    ];
    const found = findExistingProfileByCanonical(profilesWithUnknown, "", "");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("u");
  });

  it("does not match different variety with same canonical name", () => {
    // "Double Dutch" vs "Double Click" - different varieties
    expect(findExistingProfileByCanonical(baseProfiles, "Cosmos", "Double Click Series")).toBeNull();
    const found = findExistingProfileByCanonical(baseProfiles, "Cosmos", "Double Dutch");
    expect(found!.id).toBe("3");
  });
});
