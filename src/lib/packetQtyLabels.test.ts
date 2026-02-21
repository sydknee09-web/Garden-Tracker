import { describe, it, expect } from "vitest";
import { qtyStatusToLabel, usedPercentToLabel, QTY_STANDARD_VALUES } from "./packetQtyLabels";

describe("packetQtyLabels", () => {
  describe("qtyStatusToLabel", () => {
    it("maps standard values to labels", () => {
      expect(qtyStatusToLabel(100)).toBe("Full");
      expect(qtyStatusToLabel(50)).toBe("Half");
      expect(qtyStatusToLabel(25)).toBe("Low");
      expect(qtyStatusToLabel(0)).toBe("Empty");
    });

    it("falls back to percentage for non-standard values", () => {
      expect(qtyStatusToLabel(67)).toBe("67%");
      expect(qtyStatusToLabel(33)).toBe("33%");
      expect(qtyStatusToLabel(10)).toBe("10%");
    });

    it("rounds before lookup", () => {
      expect(qtyStatusToLabel(49.6)).toBe("Half"); // 49.6 rounds to 50
      expect(qtyStatusToLabel(50.4)).toBe("Half"); // 50.4 rounds to 50
    });
  });

  describe("usedPercentToLabel", () => {
    it("maps standard values to used labels", () => {
      expect(usedPercentToLabel(100)).toBe("Whole");
      expect(usedPercentToLabel(50)).toBe("Half");
      expect(usedPercentToLabel(25)).toBe("Some");
    });

    it("falls back to percentage for non-standard values", () => {
      expect(usedPercentToLabel(75)).toBe("75%");
      expect(usedPercentToLabel(30)).toBe("30%");
    });
  });

  describe("QTY_STANDARD_VALUES", () => {
    it("contains expected values", () => {
      expect(QTY_STANDARD_VALUES).toEqual([100, 50, 25, 0]);
    });
  });
});
