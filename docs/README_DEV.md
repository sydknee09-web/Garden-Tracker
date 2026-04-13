# Voyager Sanctuary | Developer Guide

## Security & RLS (Phase 4.4)

**CRITICAL:** Demo Mode (local Supabase or in-memory stubs) **does not validate RLS (Row Level Security)**.

- To verify data isolation (ensuring User A cannot see User B's data), you must run the **Two-Account Test** against a live Supabase project.
- See [RLS_VERIFICATION.md](./RLS_VERIFICATION.md) for the full audit protocol.

## Database Setup (Phase 0)

The app requires specific schema and logic to function. In your Supabase project **SQL Editor**:

1. Run the contents of [schema.sql](./schema.sql).
2. Run the contents of [MIGRATE_LOGIC_LEAF.sql](./MIGRATE_LOGIC_LEAF.sql).
3. (Optional) See [MASTER_PLAN.md](./MASTER_PLAN.md) for "Run All Migrations" and migration order.

## Local Environment

- **Environment variables:** Ensure `.env` (or dart-define) has valid `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- **Assets:** See [ASSET_MANIFEST.md](./ASSET_MANIFEST.md) for Elias and UI asset requirements.
- **Testing:** Refer to [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) before pushing to production.
