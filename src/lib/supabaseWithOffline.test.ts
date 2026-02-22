import { describe, it, expect, afterEach } from "vitest";
import { isNetworkError } from "./supabaseWithOffline";

describe("isNetworkError", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", { value: originalNavigator, configurable: true });
  });

  it("returns true for 'Failed to fetch' message", () => {
    expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
  });

  it("returns true for network-related messages", () => {
    expect(isNetworkError({ message: "Network request failed" })).toBe(true);
    expect(isNetworkError({ message: "Connection refused" })).toBe(true);
    expect(isNetworkError({ message: "Request timeout" })).toBe(true);
  });

  it("returns false for auth/session errors", () => {
    expect(isNetworkError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isNetworkError({ code: "jwt_expired", message: "Token expired" })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });

  it("returns false for non-network Postgres errors", () => {
    expect(isNetworkError({ message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isNetworkError({ message: "null value in column" })).toBe(false);
  });
});
