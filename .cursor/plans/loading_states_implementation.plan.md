---
name: Loading States Implementation
overview: Standardize loading UI with three primitives (LoadingScreen, LoadingState, SubmitLoadingOverlay); migrate in-content loading to LoadingState; U+2026 ellipsis; inline loading for quick actions; aria-live; skeleton vs spinner rule.
todos: []
isProject: false
---

# Loading States Implementation

**Current state (audit):** [LoadingState](src/components/LoadingState.tsx) exists but is never imported elsewhere. Many pages use ad-hoc "Loading…" or inline spinners. SubmitLoadingOverlay is used in modals. U+2026 not applied in UI strings. EditJournalModal (and similar) use full overlay on save; inline button loading not implemented. No documented skeleton vs spinner rule.

---

## 1. Three primitives

- **LoadingScreen** — Full-viewport; initial app load (auth) only. No change. [LoadingScreen.tsx](src/components/LoadingScreen.tsx)
- **LoadingState** — In-content "fetching data" (spinner + message). Add `role="status"` and `aria-live="polite"`. Single spinner size (e.g. w-5 h-5), message class `text-neutral-500 text-sm`. [LoadingState.tsx](src/components/LoadingState.tsx)
- **SubmitLoadingOverlay** — Form submit / mutation (Saving…, Adding…). No change. [SubmitLoadingOverlay.tsx](src/components/SubmitLoadingOverlay.tsx)

---

## 2. Harden LoadingState

**File:** [src/components/LoadingState.tsx](src/components/LoadingState.tsx)

- Add `role="status"` and `aria-live="polite"` to the wrapper div.
- Keep default message `"Loading…"` (U+2026).

---

## 3. Migrate in-content loading to LoadingState

Replace raw "Loading…" / "Loading..." paragraphs and one-off spinner divs with `<LoadingState message="…" />` in:

- [src/app/page.tsx](src/app/page.tsx) — tasks/weather loading
- [src/app/calendar/page.tsx](src/app/calendar/page.tsx)
- [src/components/PacketPickerModal.tsx](src/components/PacketPickerModal.tsx)
- [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx)
- [src/components/EditPacketModal.tsx](src/components/EditPacketModal.tsx)
- [src/app/vault/history/page.tsx](src/app/vault/history/page.tsx)
- [src/components/MyPlantsView.tsx](src/components/MyPlantsView.tsx)
- [src/components/SeedVaultView.tsx](src/components/SeedVaultView.tsx)
- [src/app/vault/plant/page.tsx](src/app/vault/plant/page.tsx)
- [src/components/ShedView.tsx](src/components/ShedView.tsx)
- [src/app/settings/extract-cache/page.tsx](src/app/settings/extract-cache/page.tsx)
- [src/app/settings/family/page.tsx](src/app/settings/family/page.tsx)
- [src/app/vault/review-import/page.tsx](src/app/vault/review-import/page.tsx) — initial load

Use consistent message: "Loading…" (generic) or "Loading packets…", "Loading plants…" etc. when specific. Prefer U+2026 everywhere.

---

## 4. U+2026 ellipsis in UI strings

Replace `"..."` (three ASCII periods) with `"…"` (U+2026) in **user-facing** button/label text only. Do not change logs, comments, or URLs.

**Files:**

- [src/app/settings/developer/page.tsx](src/app/settings/developer/page.tsx) — Delete / Un-archive button states (lines ~744, 799)
- [src/app/settings/profile/page.tsx](src/app/settings/profile/page.tsx) — Download JSON/CSV buttons (lines ~445, 448)
- [src/app/page.tsx](src/app/page.tsx) — Done button when marking (line ~569)
- [src/app/settings/family/page.tsx](src/app/settings/family/page.tsx) — Save / Create / Join buttons (lines ~457, 807, 828)

---

## 5. Inline loading for quick actions

For single-button saves (e.g. Edit Journal modal, QuickLogModal save), use **inline** loading inside the button (spinner + "Saving…" in button) instead of full SubmitLoadingOverlay, so the user is not locked out of the whole screen.

**Files:**

- [src/components/EditJournalModal.tsx](src/components/EditJournalModal.tsx) — Replace full overlay on save with disabled primary button + spinner and "Saving…" inside the button.
- [src/components/QuickLogModal.tsx](src/components/QuickLogModal.tsx) — Same pattern if save is a single action.

**Optional:** Add a small `ButtonSpinner` or `LoadingState variant="inline"` for reuse on Save/Done/Join/Create buttons.

---

## 6. Skeleton vs spinner rule

**Rule:**

- **Skeleton** — User **expects content** (list of plants, packets, calendar, vault grid). Show placeholder "bones" while data loads.
- **Spinner (LoadingState)** — User **triggered an action** (selected variety → packets loading; refresh; filter). Show spinner.

Document this in this plan or a short "Loading UI" section in docs so future work stays consistent. When adding loading UI, choose based on: initial/content load → skeleton; user-triggered → spinner.

---

## 7. Route-level loading

For `dynamic(..., { loading: () => ... })`, use `<LoadingState />` (or a wrapper that renders it) so route transitions are consistent. Examples: [VaultPageContent](src/app/vault/VaultPageContent.tsx), [schedule/page.tsx](src/app/schedule/page.tsx), [VaultPacketWing](src/app/vault/components/VaultPacketWing.tsx).

---

## Files to modify (summary)

| File | Change |
|------|--------|
| [src/components/LoadingState.tsx](src/components/LoadingState.tsx) | Add role="status", aria-live="polite" |
| Listed in sections 3–5 | Migrate to LoadingState; U+2026; inline save buttons |
| This plan / docs | Skeleton vs spinner rule |
