import { describe, it, expect, vi } from "vitest";
import { fetchWithRetry, RETRYABLE_STATUSES, DEFAULT_RETRY_DELAYS } from "./fetchWithRetry";

// No real waiting in tests — inject a no-op sleep and zero delays.
const noWait = { delays: [0, 0], sleepImpl: async () => {} } as const;

function res(status: number): Response {
  return new Response(status === 204 ? null : "{}", { status });
}

describe("fetchWithRetry", () => {
  it("retries transient 500 twice then returns the eventual success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(502))
      .mockResolvedValueOnce(res(200));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(out.ok).toBe(true);
  });

  it("returns the last non-ok response when all attempts fail with retryable status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(500));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(out.ok).toBe(false);
    expect(out.status).toBe(500);
  });

  it("does NOT retry a non-retryable 4xx — returns immediately on the first call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(400));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(400);
  });

  it("does NOT retry 429 — quota signal returns immediately (leak audit 2026-06-10 Leak 1)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(429));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(429);
  });

  it("does NOT retry 503 — load signal returns immediately (leak audit 2026-06-10 Leak 1)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(503));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(503);
  });

  it("retries a thrown network error then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(res(200));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out.ok).toBe(true);
  });

  it("propagates the error when every attempt throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(
      fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl })
    ).rejects.toThrow("network down");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns first-call success without any retry", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200));
    const out = await fetchWithRetry("/api/x", undefined, { ...noWait, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
  });

  it("waits between retries using injected delays", async () => {
    const sleeps: number[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(res(500));
    await fetchWithRetry("/api/x", undefined, {
      delays: [1000, 2000],
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl,
    });
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("exposes sensible defaults (3 attempts, 1s/2s backoff; quota signals excluded)", () => {
    expect(DEFAULT_RETRY_DELAYS).toEqual([1000, 2000]);
    expect([...RETRYABLE_STATUSES].sort()).toEqual([408, 500, 502, 504]);
    expect(RETRYABLE_STATUSES.has(429)).toBe(false);
    expect(RETRYABLE_STATUSES.has(503)).toBe(false);
    expect(RETRYABLE_STATUSES.has(400)).toBe(false);
  });
});
