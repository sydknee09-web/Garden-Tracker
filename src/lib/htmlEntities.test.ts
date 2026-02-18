import { describe, it, expect } from "vitest";
import { decodeHtmlEntities, stripHtmlForDisplay, looksLikeScientificName, toTitleCase, formatVarietyForDisplay } from "./htmlEntities";

describe("decodeHtmlEntities", () => {
  it("returns empty string for null or undefined", () => {
    expect(decodeHtmlEntities(null)).toBe("");
    expect(decodeHtmlEntities(undefined)).toBe("");
  });

  it("decodes numeric entities", () => {
    expect(decodeHtmlEntities("&#40;")).toBe("(");
    expect(decodeHtmlEntities("&#41")).toBe(")");
  });

  it("decodes named entities", () => {
    expect(decodeHtmlEntities("&amp;")).toBe("&");
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });
});

describe("stripHtmlForDisplay", () => {
  it("returns empty string for null or undefined", () => {
    expect(stripHtmlForDisplay(null)).toBe("");
    expect(stripHtmlForDisplay(undefined)).toBe("");
  });

  it("leaves plain scientific names unchanged", () => {
    expect(stripHtmlForDisplay("Lobularia maritima")).toBe("Lobularia maritima");
  });

  it("strips HTML tags", () => {
    expect(stripHtmlForDisplay("<em>Lobularia</em> maritima")).toBe("Lobularia maritima");
  });

  it("strips class and id attributes (scraped HTML fragments)", () => {
    expect(stripHtmlForDisplay('"-tulips" class="header__menu-item list-menu__item focus-inset"')).toBe(
      '"-tulips"'
    );
  });

  it("strips attributes even with no space before class (scraped fragment)", () => {
    expect(stripHtmlForDisplay('"-tulips"class="header__menu-item list-menu__item focus-inset"')).toBe(
      '"-tulips"'
    );
  });

  it("collapses whitespace and trims", () => {
    expect(stripHtmlForDisplay("  Lobularia   maritima  ")).toBe("Lobularia maritima");
  });
});

describe("looksLikeScientificName", () => {
  it("returns false for null or undefined", () => {
    expect(looksLikeScientificName(null)).toBe(false);
    expect(looksLikeScientificName(undefined)).toBe(false);
  });

  it("returns false for scraped HTML/code fragments", () => {
    expect(looksLikeScientificName('"-tulips" class="header__menu-item list-menu__item focus-inset"')).toBe(false);
    expect(looksLikeScientificName('"-tulips"')).toBe(false);
    expect(looksLikeScientificName("class=\"foo\"")).toBe(false);
  });

  it("returns true for plausible scientific names", () => {
    expect(looksLikeScientificName("Lobularia maritima")).toBe(true);
    expect(looksLikeScientificName("Solanum lycopersicum")).toBe(true);
    expect(looksLikeScientificName("Eschscholzia californica")).toBe(true);
    expect(looksLikeScientificName("Ocimum basilicum")).toBe(true);
  });

  it("returns false for sentence fragments and cultivar names", () => {
    expect(looksLikeScientificName(", and selected for improved traits.")).toBe(false);
    expect(looksLikeScientificName("Rutgers Passion DMR")).toBe(false);
    expect(looksLikeScientificName("King Size Series")).toBe(false);
    expect(looksLikeScientificName("Bee's Choice")).toBe(false);
    expect(looksLikeScientificName("selected for improved traits")).toBe(false);
  });

  it("returns false for too short or empty", () => {
    expect(looksLikeScientificName("")).toBe(false);
    expect(looksLikeScientificName("A")).toBe(false);
  });
});

describe("toTitleCase", () => {
  it("returns empty for null or undefined", () => {
    expect(toTitleCase(null)).toBe("");
    expect(toTitleCase(undefined)).toBe("");
  });
  it("title-cases lowercase words", () => {
    expect(toTitleCase("giga white")).toBe("Giga White");
    expect(toTitleCase("king size series")).toBe("King Size Series");
  });
  it("normalizes all-caps", () => {
    expect(toTitleCase("RUTGERS PASSION")).toBe("Rutgers Passion");
  });
  it("preserves hyphenated parts as words", () => {
    expect(toTitleCase("duchesse formula")).toBe("Duchesse Formula");
  });
});

describe("formatVarietyForDisplay", () => {
  it("returns empty for empty or dash", () => {
    expect(formatVarietyForDisplay("", false)).toBe("");
    expect(formatVarietyForDisplay("—", false)).toBe("");
  });
  it("title-cases when not scientific", () => {
    expect(formatVarietyForDisplay("giga white", false)).toBe("Giga White");
  });
  it("preserves when scientific", () => {
    expect(formatVarietyForDisplay("fascicularis", true)).toBe("fascicularis");
  });
});
