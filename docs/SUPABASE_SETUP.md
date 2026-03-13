# Supabase setup for Voyager Sanctuary

## Required before running the app

1. **Create or restore your Supabase project**  
   In [Supabase Dashboard](https://supabase.com/dashboard), create a project or open an existing one. If the project was paused, click **Restore**.

2. **Apply the schema**  
   In your project, go to **SQL Editor** and run the contents of [schema.sql](schema.sql) (or paste the full file). This creates `profiles`, `ensure_profile()`, and all app tables. The default project reference in code may be paused or invalid; use your own project's URL and anon key.

3. **Build with your project URL and key**  
   Get **Project URL** and **anon public** key from **Settings → API** in the dashboard. Then build the app with:
   ```bash
   flutter run --dart-define=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
   Or, for a private repo only, you can set the default values in `lib/core/config/supabase_config.dart` (not recommended if the repo is shared).

Without these steps, you may see `RealtimeSubscribeException` (host lookup) or `PostgrestException` (e.g. `ensure_profile` not found).
