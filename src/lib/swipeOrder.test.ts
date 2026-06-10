import { describe, it, expect, beforeEach } from "vitest";
import { setSwipeOrder, getSwipeOrder } from "./swipeOrder";

describe("swipeOrder", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("returns the snapshot when it includes the current id", () => {
    setSwipeOrder("profiles", ["a", "b", "c"]);
    expect(getSwipeOrder("profiles", "b")).toEqual(["a", "b", "c"]);
  });

  it("returns null (fall back) when the current id is not in the snapshot", () => {
    setSwipeOrder("profiles", ["a", "b", "c"]);
    expect(getSwipeOrder("profiles", "z")).toBeNull();
  });

  it("returns null when no snapshot exists for the scope", () => {
    expect(getSwipeOrder("packets", "a")).toBeNull();
  });

  it("isolates scopes (a profiles snapshot is not read as packets)", () => {
    setSwipeOrder("profiles", ["a", "b"]);
    expect(getSwipeOrder("packets", "a")).toBeNull();
  });

  it("ignores malformed stored data", () => {
    window.sessionStorage.setItem("swipeOrder:profiles", "not json");
    expect(getSwipeOrder("profiles", "a")).toBeNull();
    window.sessionStorage.setItem("swipeOrder:profiles", JSON.stringify({ not: "an array" }));
    expect(getSwipeOrder("profiles", "a")).toBeNull();
    window.sessionStorage.setItem("swipeOrder:profiles", JSON.stringify([1, 2, 3]));
    expect(getSwipeOrder("profiles", "1")).toBeNull();
  });

  it("the latest snapshot replaces the prior one for a scope", () => {
    setSwipeOrder("packets", ["a", "b"]);
    setSwipeOrder("packets", ["c", "d"]);
    expect(getSwipeOrder("packets", "a")).toBeNull();
    expect(getSwipeOrder("packets", "d")).toEqual(["c", "d"]);
  });

  it("supports the instances scope (Sprint 3 — Garden tab → instance page swipe)", () => {
    setSwipeOrder("instances", ["g1", "g2", "g3"]);
    expect(getSwipeOrder("instances", "g2")).toEqual(["g1", "g2", "g3"]);
    expect(getSwipeOrder("instances", "gX")).toBeNull(); // archived/deep-link id not in snapshot → fall back
    expect(getSwipeOrder("profiles", "g1")).toBeNull(); // scope isolation
  });
});
