/**
 * Shared test helpers: fake data factories and Supabase mock utilities.
 * Import from @/test/helpers in any test that needs auth, DB rows, or a client mock.
 */
import { vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { PlantProfile, SeedPacket, GrowInstance } from "@/types/garden";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** A fake Supabase auth user for unit tests. */
export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

// ---------------------------------------------------------------------------
// Supabase query-builder mock
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Supabase query-builder mock.
 * Every fluent method (select, eq, in, is, …) returns the same mock object.
 * Awaiting the chain resolves to { data, error } per the result argument.
 * Override `.maybeSingle` / `.single` per-test to return specific row data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeSbChain(result: { data?: any; error?: any } = {}): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
    ),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
    ),
  };
  // Make the chain itself thenable so `await supabase.from(...).update(...).eq(...)` resolves.
  chain.then = (
    resolve: (v: { data: unknown; error: unknown }) => void
  ) =>
    Promise.resolve({
      data: result.data ?? [],
      error: result.error ?? null,
    }).then(resolve);
  return chain;
}

/**
 * Creates a lightweight Supabase client mock.
 * `from` returns a fresh chainable mock per call; override `fromResult` for specific row data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeSbMock(fromResult: { data?: any; error?: any } = {}) {
  return {
    from: vi.fn(() => makeSbChain(fromResult)),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test/path.jpg" }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/test.jpg" } })),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// DB row factories
// ---------------------------------------------------------------------------

export function fakePlantProfile(overrides: Partial<PlantProfile> = {}): PlantProfile {
  return {
    id: "profile-1",
    user_id: "test-user-id",
    name: "Tomato",
    variety_name: "Cherokee Purple",
    profile_type: "seed",
    status: "vault",
    tags: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

export function fakeSeedPacket(overrides: Partial<SeedPacket> = {}): SeedPacket {
  return {
    id: "packet-1",
    plant_profile_id: "profile-1",
    user_id: "test-user-id",
    qty_status: 100,
    is_archived: false,
    deleted_at: null,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function fakeGrowInstance(overrides: Partial<GrowInstance> = {}): GrowInstance {
  return {
    id: "grow-1",
    plant_profile_id: "profile-1",
    user_id: "test-user-id",
    sown_date: "2025-03-01",
    expected_harvest_date: null,
    status: "growing",
    created_at: "2025-03-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}
