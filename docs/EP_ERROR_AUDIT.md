# EP Error Audit — "Cannot access 'ep' before initialization"

**Error:** `Cannot access 'ep' before initialization` on Vault page  
**Context:** Occurs when accessing Seed Vault tab (or Vault in general). Happens on both phone and computer (rules out cache).

---

## Migration Order Question

**Could the error stem from running the SQL migration before the migrate-to-plant-packets.ts script?**

**Short answer: No.** The "ep" error is a **client-side JavaScript ReferenceError** (temporal dead zone). It happens during module evaluation or component initialization in the browser. Database migrations affect:

- Schema (columns, tables)
- Data (what's stored)

If you ran the SQL before the migrate script, you would see **database errors** like:
- `column "plant_variety_id" does not exist`
- Query failures when the app selects that column

You would **not** see "Cannot access 'ep' before initialization" — that's a bundling/initialization order issue in the JavaScript bundle.

**Migration order still matters for data integrity:**
1. Run `scripts/migrate-to-plant-packets.ts` first (copies plant_varieties + seed_stocks → plant_profiles + seed_packets)
2. Then run the SQL migration (drops plant_variety_id columns)

If you did it backwards, your data may be inconsistent, but that would surface as DB/query errors, not "ep".

---

## Possible Causes (Audit)

### 1. Circular Dependencies
- **Vault page** imports SeedVaultView, PacketVaultView (dynamic), ShedView, etc.
- **SeedVaultView** imports @tanstack/react-table, useAuth, useHousehold, etc.
- **PacketVaultView** imports useAuth, useHousehold, etc.
- If any chain leads back (e.g. A → B → C → A), module init can fail.

**Mitigations applied:** PacketStatusFilter moved to shared types; PacketVaultView dynamically imported.

### 2. usePathname / useSearchParams
- Both **AuthGuard** and **VaultPageInner** use `usePathname()`.
- Next.js navigation hooks can suspend; they must be inside Suspense.
- If the bundler minifies an internal variable to "ep" and there's init-order bug, we'd see this.

**Mitigation:** Deferred mount so vault content only renders after client hydration.

### 3. Variable Used Before Declaration (Temporal Dead Zone)
- `const x = y; const y = 1;` → ReferenceError.
- "ep" is likely a minified variable name (e.g. from "pathname", "expand", "params").
- Could be in our code or a dependency (Next.js, React, @tanstack/react-table).

### 4. Seed Vault Switch (Plant Profiles → Packets)
- Seed Vault tab used to show SeedVaultView in list mode (plant profiles table).
- Now shows PacketVaultView (seed packets).
- The switch added PacketVaultView to the vault page. If PacketVaultView or its import chain has a circular ref or init-order issue, that could cause "ep" when the tab is shown or when the page loads with tab=list.

### 5. Legacy Code (plant_variety_id, seed_stocks)
- `src/lib/vault.ts` still has SeedStockDisplay, normalizeSeedStockRow for legacy seed_stocks.
- Vault page does **not** import vault.ts directly.
- SeedVaultView imports from @/types/vault (PlantProfileDisplay, Volume) — no vault.ts.
- Unlikely to be the direct cause, but legacy types exist.

---

## Fixes Applied

1. **PacketStatusFilter** moved to `@/types/vault` — vault page no longer imports from PacketVaultView for types.
2. **PacketVaultView** dynamically imported — loads only when Seed Vault tab is shown.
3. **Deferred mount** — vault content renders only after client mount, avoiding init-order issues with usePathname/useSearchParams during first paint.

---

## If Error Persists

- Add `console.log` or breakpoints in VaultPageInner to see how far render gets.
- Build with `next build` and inspect the generated chunks for "ep".
- Try temporarily removing SeedVaultView (render empty div for grid) to see if error moves.
- Check Next.js version and consider upgrading if a known fix exists.
