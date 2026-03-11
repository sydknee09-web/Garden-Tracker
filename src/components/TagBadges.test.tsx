import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagBadges, getTagStyle } from "./TagBadges";

describe("getTagStyle", () => {
  it("returns known style for Heirloom", () => {
    expect(getTagStyle("Heirloom")).toContain("amber");
  });

  it("returns known style for Organic", () => {
    expect(getTagStyle("Organic")).toContain("emerald");
  });

  it("returns known style for Non-GMO", () => {
    expect(getTagStyle("Non-GMO")).toContain("violet");
  });

  it("returns known style for F1", () => {
    expect(getTagStyle("F1")).toContain("sky");
  });

  it("returns known style for Hybrid", () => {
    expect(getTagStyle("Hybrid")).toContain("slate");
  });

  it("returns default style for unknown tag", () => {
    expect(getTagStyle("SomeUnknownTag")).toContain("neutral");
  });

  it("trims whitespace before lookup", () => {
    expect(getTagStyle("  Heirloom  ")).toContain("amber");
  });
});

describe("TagBadges", () => {
  it("renders null when tags array is empty", () => {
    const { container } = render(<TagBadges tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when tags is undefined/null", () => {
    // @ts-expect-error testing runtime safety
    const { container } = render(<TagBadges tags={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one badge per non-empty tag", () => {
    render(<TagBadges tags={["Heirloom", "Organic", "Non-GMO"]} />);
    expect(screen.getByText("Heirloom")).toBeInTheDocument();
    expect(screen.getByText("Organic")).toBeInTheDocument();
    expect(screen.getByText("Non-GMO")).toBeInTheDocument();
  });

  it("skips empty string tags", () => {
    render(<TagBadges tags={["Heirloom", "", "Organic"]} />);
    const badges = screen.getAllByText(/Heirloom|Organic/);
    expect(badges).toHaveLength(2);
  });

  it("applies the correct style class for a known tag", () => {
    render(<TagBadges tags={["Heirloom"]} />);
    const badge = screen.getByText("Heirloom");
    expect(badge.className).toContain("amber");
  });

  it("applies default style class for an unknown tag", () => {
    render(<TagBadges tags={["CustomTag"]} />);
    const badge = screen.getByText("CustomTag");
    expect(badge.className).toContain("neutral");
  });

  it("accepts an optional className prop on the wrapper", () => {
    const { container } = render(<TagBadges tags={["F1"]} className="mt-2" />);
    expect(container.firstChild).toHaveClass("mt-2");
  });
});
