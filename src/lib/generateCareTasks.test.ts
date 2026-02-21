import { describe, it, expect } from "vitest";
import { getEffectiveInstanceIds } from "./generateCareTasks";

describe("getEffectiveInstanceIds", () => {
  it("returns grow_instance_ids when non-empty", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "b"] })).toEqual(["a", "b"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["x"] })).toEqual(["x"]);
  });

  it("dedupes grow_instance_ids", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "a", "b"] })).toEqual(["a", "b"]);
  });

  it("returns [grow_instance_id] when grow_instance_ids is null/empty and grow_instance_id is set", () => {
    expect(getEffectiveInstanceIds({ grow_instance_id: "single-id" })).toEqual(["single-id"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: null, grow_instance_id: "x" })).toEqual(["x"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: [], grow_instance_id: "y" })).toEqual(["y"]);
  });

  it("returns null when both are null/empty (all plants)", () => {
    expect(getEffectiveInstanceIds({})).toBeNull();
    expect(getEffectiveInstanceIds({ grow_instance_ids: null, grow_instance_id: null })).toBeNull();
    expect(getEffectiveInstanceIds({ grow_instance_ids: [] })).toBeNull();
  });

  it("prefers grow_instance_ids over grow_instance_id when both set", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "b"], grow_instance_id: "x" })).toEqual(["a", "b"]);
  });
});
