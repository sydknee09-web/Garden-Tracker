import { describe, it, expect } from "vitest";
import { decodeHtmlEntities, stripHtmlForDisplay } from "./htmlEntities";

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

  it("collapses whitespace and trims", () => {
    expect(stripHtmlForDisplay("  Lobularia   maritima  ")).toBe("Lobularia maritima");
  });
});
