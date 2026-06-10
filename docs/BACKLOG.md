# Backlog (on hold)

**Last updated:** 2026-05-23 (added warranty/receipt save per-plant feature idea)

Preliminary issues and earlier notes captured for when you're ready. Not part of the phased roadmap; implement in a future sprint or fold into a relevant phase.

**Roadmap:** See [.cursor/plans/remaining_steps_roadmap.plan.md](../.cursor/plans/remaining_steps_roadmap.plan.md) for the ordered plan. Phases 0–7 are now done; 8 and 9 are partial. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the verified status table.

---

## Plant profile (Vault [id])

- **Plant warranty / receipt save (per-plant document attachment).** *Raised 2026-05-23.* Let the user save a purchase order or receipt against an individual plant for warranty tracking — useful for nursery-purchased fruit trees, perennials, or any plant that came with a warranty. Currently no place to attach a document (PDF, image of receipt, order confirmation) directly to a grow instance or plant profile. Same workstream theme as [BUGS.md](BUGS.md) S2 ("Original uploaded photos / receipts are discarded after AI extraction") — bundle when receipt-retention infrastructure lands. Sized M (storage + DB column on `grow_instances` or new `plant_documents` table + upload UI + view/download UI on profile + grow instance modal). Long-term; revisit post-MVP once memory plane + per-plant retention thinking matures.
- **Packets tab:** Add **Edit** button next to "Remove packet" (opens EditPacketModal). *Confirmed still open 2026-05-07 — [VaultProfilePacketsTab.tsx](../src/app/vault/[id]/VaultProfilePacketsTab.tsx) has delete-only.* **Update 2026-06-09 — largely addressed by the dedicated packet detail page ship (`03eee40`): the Packets tab is now a tap-through summary list, and full per-packet editing (rating / qty / date / storage / notes / vendor specs) lives on [`/vault/packets/[id]`](../src/app/vault/packets/[id]/page.tsx). Keep open only if a quick-edit-without-leaving-the-tab affordance is still wanted.**
- **Packet detail page (`/vault/packets/[id]`) — ✅ BOTH follow-ups SHIPPED 2026-06-09.** (a) Confirm-on-delete — `6f3fad4` (mirrors the Delete Plant Profile alertdialog). (b) **Swipe between packets — `60c5e31`, Option A context-aware:** from a profile → traverses that variety's packets (matching the Packets-tab order); from the Vault list → all packets, newest-first. Reused the `shed/[id]` swipe pattern + framed `md:` desktop arrows. **Packet detail page chapter fully closed.** *(Possible future cohesion: extract `shed/[id]` + packet-page swipe into a shared hook — both inline the same logic; not blocking.)*
- **Plants tab → Edit plant:** In the edit-grow modal, add **link to existing seed packet** (dropdown + include `seed_packet_id` in save).
- **Too many places to edit a plant's image** — multiple paths to change a profile photo (Add Photo / Change Photo on profile, Set Profile Photo modal, Edit Plant Profile → Change Photo, plus implicit via packet image, journal photo, etc.). User reported this as friction. Audit and consolidate. *Reported 2026-05-07.* **Partial closure 2026-05-28 — floating camera icon on profile hero removed; photo update now routes through Edit Plant Profile → Photo button only. Full audit + consolidation of remaining paths (implicit packet / journal-photo / "Add Photo" empty-state) still open.**

---

## Garden – Orange FAB selection menu

- When **exactly one item** is selected, add **Edit** option: navigate to `/vault/[profileId]?tab=plantings&editGrow=[growId]`; vault page reads `editGrow` and opens the same edit-grow modal.

---

## Garden – macro-category filter (Tree / Vegetable / Fruit / Herb / Flower)

**Gap:** Garden has a "Plant Type" filter ([garden/page.tsx:781](../src/app/garden/page.tsx)) but it filters by *specific* plant (Tomato, Carrot, Pepper, etc.) per `PLANT_CATEGORY_DEFAULTS` in [src/constants/plantDefaults.ts](../src/constants/plantDefaults.ts). There is no macro-grouping (Tree, Vegetable, Fruit, Herb, Flower, Shrub, Berry, Vine, Cover Crop, etc.).

**Why it matters:** Specific plant filter is most useful in the seed/plant bank (Vault). In the Garden, users want to ask "show me all my trees" or "show me all my herbs" — a level above species. The permanent/seasonal split (My Plants tab vs Active Garden tab) gives some of this, but doesn't separate fruit trees from shade trees, or vegetables from herbs within seasonal.

**Scope (medium effort, ~half-day to a day):**
1. Decide the taxonomy. Suggested starter: Tree, Fruit Tree, Shrub, Berry, Vine, Vegetable, Leafy Green, Herb, Flower, Cover Crop. Lock in [src/constants/plantDefaults.ts](../src/constants/plantDefaults.ts) or a new `plantCategories.ts`.
2. Add `plant_category` column on `plant_profiles` (migration). Nullable to start.
3. Backfill existing data — single AI pass across user's profiles via Gemini (similar pattern to existing fill-blanks-for-profile route), or manual sweep with a developer-only batch tool. Plan for imperfect classification; add UI to edit category on the profile.
4. Wire up new filter section on Garden refine-by panel for both Active Garden + My Plants. Mirror existing chip pattern. Optional: add to Vault for parity.
5. Update import/AI flows ([scrape-url](../src/app/api/seed/scrape-url/route.ts), [extract](../src/app/api/seed/extract/route.ts), [enrich-from-name](../src/app/api/seed/enrich-from-name/route.ts)) to populate `plant_category` for new profiles.

**Quick-and-dirty alternative:** Use existing `tags` field — add canonical category tags ("Tree", "Vegetable", etc.), filter on tags. No schema change. Downside: tags are user-editable free-form, so categorization quality drifts.

---

## Earlier notes

- **Plant again with no packets** → Add Plant with "Link existing" pre-filled.
- **FAB delay** (if any perceived lag when opening FAB menu).
- **QuickAddSeed link-existing:** sort + search improvements.
- **Journal icon** (on planting card) → Add Journal Entry modal (or confirm vs "go to Journal tab" per Phase 4).
- **Multi-supply per journal entry** (e.g. multiple supplies used in one care entry). *(In progress: journal_entry_supplies table + Quick Log UX plan.)*
- **BatchLogSheet → SearchableMultiSelect:** Migrate BatchLogSheet plant selection to use SearchableMultiSelect for consistency with Quick Log and journal/new. Every multi-select in the Vault should follow this pattern.
- **Quick-action submit** without photo/note (allow minimal submit).
- **Care tab on all profiles** (or keep Care only on permanent; document decision).
