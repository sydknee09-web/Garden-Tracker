# Voyager Sanctuary

Refined architectural luxury goal-execution app. Built with Flutter + Supabase + Riverpod.

---

## Supabase setup (required before running)

1. **Create or restore your Supabase project**  
   In [Supabase Dashboard](https://supabase.com/dashboard), create a project or open the existing one. If the project was paused (free tier pauses after inactivity), click **Restore**.

2. **Apply the schema**  
   In your project: **SQL Editor → New query**, paste the contents of [`docs/schema.sql`](docs/schema.sql) and run it. This creates all tables (`profiles`, `mountains`, `nodes`, `satchel_slots`, `whetstone_items`, `whetstone_completions`), the `ensure_profile()` function, RLS policies, and triggers. It is idempotent — safe to re-run.

3. **Apply all migrations**  
   In **SQL Editor → New query**, paste the contents of [`docs/MIGRATE_LOGIC_LEAF.sql`](docs/MIGRATE_LOGIC_LEAF.sql) and run it. This applies all incremental migrations (ritual/archive, master ledger, Elias intro, streaks, appearance, Logic & Leaf trigger, RPCs). Idempotent — safe to re-run.

4. **Get your project URL and anon key**  
   In the dashboard: **Settings → API**. Copy the **Project URL** and the **anon public** key.

5. **Build with your credentials**  
   ```bash
   flutter run \
     --dart-define=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
     --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
   Without these flags the app falls back to a default project that may be paused, which causes `RealtimeSubscribeException` (host lookup) or `PostgrestException` (PGRST202) errors on screen.

---

## Running the app

```bash
flutter pub get
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

---

## Key docs

| File | Contents |
|------|--------|
| `docs/schema.sql` | Full Supabase schema — run once in SQL Editor |
| `docs/MIGRATE_LOGIC_LEAF.sql` | All migrations — run after schema.sql |
| `docs/MASTER_PLAN.md` | Master plan — all phases and tasks |
| `docs/ARCHITECTURE.md` | Data model and layer overview |
| `docs/CONVENTIONS.md` | How we add audio, assets, features, and code |
| `docs/BUGS_DEFERRED_TO_PHASE.md` | Bugs noted but deferred to a future phase |
