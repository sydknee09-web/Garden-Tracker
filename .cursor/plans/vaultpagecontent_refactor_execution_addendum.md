# VaultPageContent Refactor — Execution Addendum

**Based on pre-refactor audit + your answers.** Apply this sequencing when executing the split.

---

## 1. VaultProvider first (before any wing extraction)

- Add a **minimal VaultProvider** that provides:
  - `refetchTrigger` / `refetch()` (increment trigger or callback)
  - `scrollContainerRef` (RefObject)
  - Optionally `viewMode` and `setViewMode` so tab switching can stay in the shell and wings can read/write from context
- Wrap the vault page content (current `VaultPageInner` or its parent in [src/app/vault/page.tsx](src/app/vault/page.tsx)) with this provider.
- Refactor `VaultPageInner` to consume these from context instead of local state for refetch/scroll (and optionally viewMode). No extraction of wings yet—just swap source of truth to context.
- **Checkpoint:** Vault page behavior unchanged; refetch and scroll ref come from context. Re-run tests.

---

## 2. Consolidate inline icons into styleDictionary

- In [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx) the following are defined locally and should be moved to [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx) (or equivalent ICON_MAP):
  - ShovelIcon
  - Trash2Icon
  - CalendarIcon
  - PencilIcon
  - MergeIcon
  - ShoppingListIcon
  - PhotoCardsGridIcon (photo cards grid)
  - CondensedGridIcon (condensed grid)
- Use `strokeWidth: 1.5` (or the existing iconProps()) for consistency with Laws/audit.
- Replace all usages in VaultPageContent with e.g. `ICON_MAP.Shovel`, `ICON_MAP.Trash`, etc. If a name doesn’t exist yet, add it to styleDictionary.
- **Checkpoint:** No visual/UX change; icons centralized. Re-run tests.

---

## 3. Dead-wood purge

- Remove unused imports from VaultPageContent: `compressImage`, `Suspense`.
- **Checkpoint:** Lint clean. Re-run tests.

---

## 4. Staged wing extraction (after 1–3)

- **Stage 1 — Shed wing:** Extract Shed tab + shed-only state/handlers; have it use VaultProvider for refetch and scrollContainerRef. Re-run tests.
- **Stage 2 — Packet list wing:** Extract Seed Vault (list) tab + packet* state and persistence; consume refetch/scroll from context. Re-run tests.
- **Stage 3 — Grid wing:** Extract Plant Profiles (grid) tab + grid-specific state; shell keeps FAB, modals, tab switcher, selection state for grid+list. Re-run tests.
- **Stage 4 (optional):** Move more shared state (e.g. selection, filters) into context if it simplifies the shell.

---

## 5. Tests

- After **each** of the steps above (VaultProvider, icons, purge, and each stage), update any E2E or component tests that target the vault page and re-run the full test suite.
- If no vault-specific tests exist yet, add at least one smoke test (e.g. vault loads, tab switch, FAB opens) before Stage 1 so refactors don’t regress behavior.

---

## Order of operations summary

| Step | Action |
|------|--------|
| 0 | (Optional) Add vault smoke test if missing |
| 1 | Add VaultProvider; refactor VaultPageInner to use it for refetch + scrollRef (and optionally viewMode) |
| 2 | Consolidate 8 inline SVGs into styleDictionary; use ICON_MAP in VaultPageContent |
| 3 | Remove dead imports (compressImage, Suspense) |
| 4a | Stage 1: Extract Shed wing |
| 4b | Stage 2: Extract Packet list wing |
| 4c | Stage 3: Extract Grid wing; optional Stage 4 context expansion |

After each step: run tests and fix any failures before proceeding.
