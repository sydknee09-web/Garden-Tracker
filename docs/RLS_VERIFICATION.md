# RLS Verification — Two Accounts Cannot See Each Other's Data

**Phase 11 exit criterion.** Row-Level Security (RLS) ensures each user only sees and modifies their own rows. This guide describes how to confirm that two separate test accounts are fully isolated.

## Prerequisites

- Supabase project with the Voyager Sanctuary schema applied (`docs/schema.sql`).
- Two different email addresses (or use one email + a “+alias” variant if your provider supports it, e.g. `you+testb@gmail.com`).

## Steps

### 1. Create and use Account A

1. Open the app and **Create account** with **Account A** (e.g. `account-a@example.com`).
2. Sign in. Create at least one **Mountain** and add a **Boulder** and **Pebble** (or use the Mallet on the Scroll).
3. **Pack Satchel** and add a **Whetstone** habit. Check off a habit for today.
4. Note what you see: mountain name, pebble title, satchel contents, whetstone completions.

### 2. Sign out and use Account B

1. Open **Settings** (from Management or Satchel empty-slot tap) and **Sign out**. Confirm.
2. **Create account** with **Account B** (e.g. `account-b@example.com`) — or sign in if already created.
3. You should see:
   - **Scroll:** No mountains (or only mountains created by B).
   - **Satchel:** Empty slots (or only what B has packed).
   - **Whetstone:** No habits (or only B’s habits); no completions from A.

### 3. Confirm isolation

- Account B must **not** see:
  - Any mountains, boulders, or pebbles created by A.
  - Any satchel slots filled by A.
  - Any whetstone items or completions created by A.
- Create a mountain (or habit) as B. Sign out and sign back in as A. A must **not** see B’s new data.

### 4. Poison-record test (definitive RLS check)

This test proves RLS blocks cross-user access even when a row exists for another user.

1. **Get User_B’s UUID:** Sign in as User B (or create Account B), then in Supabase **Authentication → Users**, copy User B’s UUID.
2. **Create poison record:** In Supabase **SQL Editor**, run:
   ```sql
   INSERT INTO mountains (id, user_id, name, created_at, updated_at)
   VALUES (
     gen_random_uuid(),
     'USER_B_UUID_HERE',  -- replace with User B's actual UUID
     'Poison Peak (User B)',
     now(),
     now()
   );
   ```
3. **Sign in as User_A** in the app (do not use SKIP_AUTH; use real auth).
4. **Verify:** User A must **not** see "Poison Peak (User B)" on the Scroll. If it appears, RLS is failing.
5. **Cleanup:** In SQL Editor, delete the poison row:
   ```sql
   DELETE FROM mountains WHERE name = 'Poison Peak (User B)';
   ```

### 5. Optional: Supabase Dashboard check

- In Supabase **Table Editor**, open `mountains`, `nodes`, `satchel_slots`, `whetstone_items`, `whetstone_completions`, `user_streaks`.
- Rows are keyed by `user_id`. Confirm that `user_id` values match the auth UUID of the account that created them (you can get UUIDs from **Authentication → Users**).
- Even as project owner in the Dashboard you see all rows; RLS applies to **client requests** using each user’s JWT. The app uses the anon key and user JWT, so in the running app each account only sees its own rows.

## Policy summary

| Table                   | Policy                          | Effect                          |
|-------------------------|----------------------------------|---------------------------------|
| `profiles`              | `auth.uid() = id`               | Own profile only                |
| `mountains`             | `auth.uid() = user_id`          | Own mountains only              |
| `nodes`                 | `auth.uid() = user_id`          | Own nodes only                  |
| `satchel_slots`         | `auth.uid() = user_id`          | Own satchel only                |
| `whetstone_items`       | `auth.uid() = user_id`          | Own habits only                 |
| `whetstone_completions` | `auth.uid() = user_id`          | Own completions only            |
| `user_streaks`          | `auth.uid() = user_id`          | Own streak only                 |

All app repositories already scope queries with `SupabaseService.userId` (from the signed-in user’s JWT). RLS is a second layer: even if the app had a bug and forgot to filter by `user_id`, the database would still restrict rows to the current user.

## Result

- If both accounts see only their own data after sign-in/sign-out, **RLS verification passes** and Phase 11 exit criterion is met.
