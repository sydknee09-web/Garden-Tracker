import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logEvent } from "./debugLog";

describe("logEvent", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits `[scope] action {}` when payload omitted", () => {
    logEvent("app", "boot");
    expect(logSpy).toHaveBeenCalledWith("[app] boot", {});
  });

  it("emits `[scope] action` with payload object when provided", () => {
    logEvent("db", "ok", { table: "tasks", op: "insert", ms: 42 });
    expect(logSpy).toHaveBeenCalledWith("[db] ok", { table: "tasks", op: "insert", ms: 42 });
  });

  it("matches bracket-prefix sibling shape from apiErrorLog", () => {
    logEvent("nav", "enter", { path: "/calendar" });
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/^\[[a-z_]+\] [a-z_]+$/);
  });

  it("never throws when console.log throws", () => {
    logSpy.mockImplementation(() => {
      throw new Error("console broken");
    });
    expect(() => logEvent("toast", "error", { message: "x" })).not.toThrow();
  });
});
