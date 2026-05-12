import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  pushEntry,
  getEntries,
  clearEntries,
  installConsoleCapture,
  uninstallConsoleCapture,
  formatEntriesForCopy,
  __test__,
} from "./debugLogBuffer";

describe("debugLogBuffer", () => {
  beforeEach(() => {
    clearEntries();
  });

  afterEach(() => {
    uninstallConsoleCapture();
    clearEntries();
  });

  it("captures log/warn/error levels", () => {
    pushEntry("log", ["hello"]);
    pushEntry("warn", ["careful"]);
    pushEntry("error", ["bad"]);
    const entries = getEntries();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.level)).toEqual(["log", "warn", "error"]);
    expect(entries.map((e) => e.message)).toEqual(["hello", "careful", "bad"]);
  });

  it("respects the 50-entry rolling limit", () => {
    for (let i = 0; i < 75; i++) pushEntry("log", [`msg-${i}`]);
    const entries = getEntries();
    expect(entries).toHaveLength(__test__.MAX_ENTRIES);
    expect(entries[0].message).toBe("msg-25");
    expect(entries[entries.length - 1].message).toBe("msg-74");
  });

  it("safe-stringifies non-string args including circular references", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    pushEntry("log", ["state", circular]);
    const entries = getEntries();
    expect(entries[0].message).toContain("state");
    expect(entries[0].message).toContain("[non-serializable]");
  });

  it("formats Error objects with name + message", () => {
    pushEntry("error", [new Error("boom")]);
    const entries = getEntries();
    expect(entries[0].message).toContain("Error: boom");
  });

  it("clears entries", () => {
    pushEntry("log", ["x"]);
    expect(getEntries()).toHaveLength(1);
    clearEntries();
    expect(getEntries()).toHaveLength(0);
  });

  it("install is idempotent (calling installConsoleCapture twice does not double-push)", () => {
    installConsoleCapture();
    installConsoleCapture();
    const marker = `idempotent-marker-${Date.now()}`;
    const before = getEntries().length;
    console.log(marker);
    const after = getEntries().length;
    expect(after - before).toBe(1);
    expect(getEntries().filter((e) => e.message === marker)).toHaveLength(1);
  });

  it("uninstall restores original console", () => {
    const before = console.log;
    installConsoleCapture();
    expect(console.log).not.toBe(before);
    uninstallConsoleCapture();
    expect(console.log).toBe(before);
  });

  it("formatEntriesForCopy outputs newest-first plain text", () => {
    pushEntry("log", ["first"]);
    pushEntry("warn", ["second"]);
    const out = formatEntriesForCopy(getEntries());
    const lines = out.split("\n");
    expect(lines[0]).toContain("[WARN] second");
    expect(lines[1]).toContain("[LOG] first");
  });

  it("captures console output app-wide once installed", () => {
    installConsoleCapture();
    const marker = `capture-marker-${Date.now()}`;
    console.warn(marker);
    const entries = getEntries();
    expect(entries.some((e) => e.message === marker && e.level === "warn")).toBe(true);
  });
});
