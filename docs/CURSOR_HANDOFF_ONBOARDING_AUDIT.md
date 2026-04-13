# Voyager Sanctuary: Cursor hand-off — Onboarding audit

Use this when starting a new Cursor chat or handing off the onboarding work.

---

## One-line brief

I have a complete audit plan for my Flutter/Supabase app. Focus on **lib/** and **supabase/** to resolve UI lag, keyboard friction, and RLS errors. Standardize the onboarding flow to use a **1.2s delay** for input elements, implement the **Done/Continue** button toggle (when focused = "Done" to dismiss keyboard; when blurred = "Continue" to advance), and apply the **RLS policies** for `profiles` and `mountains`. Remove all dialogue underlines and use **Bold Parchment** for emphasis.

---

## Implemented so far

- **RLS migration:** [supabase/migrations/20250320000006_rls_profiles_mountains.sql](../supabase/migrations/20250320000006_rls_profiles_mountains.sql) — enables RLS on `profiles` and `mountains` with policies so users can view/update own profile and manage own mountains.
- **Elias intro overlay:** FocusNode for name field; **Done** (dismiss keyboard) when focused, **Continue** (ember) when blurred; 1.2s stagger for input; AnimatedSlide from `Offset(0, 0.05)`; scrim gradient (transparent → `0xCC0D2818`); placeholder grey + italic. When opening the New Journey wizard from intro, **returnLabel: 'Stow the Map'** so only the right button is "Continue".
- **Climb flow overlay:** Staggered input (1.2s; 800ms for Appearance/Logic); **Done** when a text field has focus (Intent, Identity, Markers), **Continue** when blurred; exit button uses `returnLabel` (default **Stow the Map**; intro passes same). Try/catch + "Couldn't save" SnackBar on Theme, Logic, Markers, and pebble create.
- **Whetstone intro sheet:** Stagger, Done/Continue where applicable, try/catch + "Couldn't save" SnackBar.
- **Elias dialogue:** Line break after first sentence for intro beats where specified.

---

## Still to do

- **Verify on device:** Run the **Onboarding / first-run verification** section of [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) on the latest Firebase build. (RLS migration 20250320000006 is already applied; no need to re-apply unless using a new Supabase project.)
- **Optional:** Themed (Elias-style) "Couldn't save" message and use it consistently in all save-failure SnackBars.
- **Optional:** .cursorrules or **.cursor/rules/onboarding-design.mdc** with design rules (stagger timing, Done/Continue, Stow the Map).

Before calling onboarding "done", run the Onboarding section of TESTING_CHECKLIST.md on the latest Firebase build and record pass/fail.
