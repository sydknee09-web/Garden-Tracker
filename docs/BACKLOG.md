# Backlog (on hold)

Preliminary issues and earlier notes captured for when you're ready. Not part of the phased roadmap; implement in a future sprint or fold into a relevant phase.

**Roadmap:** See [.cursor/plans/remaining_steps_roadmap.plan.md](../.cursor/plans/remaining_steps_roadmap.plan.md) for the ordered Phase 0–9 plan.

---

## Plant profile (Vault [id])

- **Packets tab:** Add **Edit** button next to "Remove packet" (opens EditPacketModal).
- **Plants tab → Edit plant:** In the edit-grow modal, add **link to existing seed packet** (dropdown + include `seed_packet_id` in save).

---

## Garden – Orange FAB selection menu

- When **exactly one item** is selected, add **Edit** option: navigate to `/vault/[profileId]?tab=plantings&editGrow=[growId]`; vault page reads `editGrow` and opens the same edit-grow modal.

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
