# PERSONAS.md — User personas for plan-audit thought reviews

> Locked 2026-05-17 (sharing-UX chat). Use this file in plan-audit Pass 2 (concerns hunt) and Pass 3 (sibling sweep) when work touches user-facing surfaces. Ask: *"Does this change work for each persona — or does it confuse, exclude, or feel built-for-someone-else?"*

---

## How to use this file

When designing or auditing user-facing work:

1. Run the proposed change through each persona below
2. Ask: *"Would [Persona] understand this?"* / *"Does this serve their goals?"* / *"Would this push them away?"*
3. Flag persona-specific risks as Pass 2 findings (concerns hunt) or Pass 3 findings (sibling sweep — does an existing pattern already work for them?)
4. If a change can't work for all 5 personas, decide which to prioritize and which to gracefully degrade for — and capture the trade-off in the plan

**When to skip this file:** tooling work, pure backend, docs-only changes, refactors with no UX surface.

**When to use it:** every UI/UX decision, copy choices, onboarding work, feature additions, lifecycle/state-machine work, sharing-UX work.

---

## Persona 1 — Maya, the Power Gardener

**Demographic:** 38, suburban Southern California; lives with husband and two teens; large vegetable and flower garden plus a chicken coop. Converted a side yard into a "greenhouse" with grow lights.

**Gardening experience + scale:** 12+ years serious gardening; experimental, scientific approach. Each season: 150-200 seed starts across 30-50 varieties; 80-120 transplanted to multiple beds; 30-50 extras shared, traded, or gifted. Tracks germination rate; keeps detailed notes year over year.

**Primary goals from the app:**
- Multi-season memory ("which Brandywine variety did best in 2024?")
- Batch lifecycle tracking from seed packet through harvest
- Sharing extras with sister + 3 close friends + small online community
- Microclimate-aware advice (her property has 4 distinct sun zones)

**Friction points:**
- Hand-holding / over-onboarding ("I know what germination rate is, don't explain it")
- Hidden depth (if power features require digging through 4 menus)
- Forced simplification ("just type a note" — she wants the structured field)
- Slow UX or laggy lists (she has hundreds of items)

**Tech comfort:** High. iPhone + iPad + MacBook. Won't be confused by long-press, swipe gestures, multi-step flows.

**Representative quote:** *"I want to look back in 3 years and see exactly which seedlings I started on March 15, 2024, which made it to harvest, and what the yield was per square foot. That's why I'm tracking this."*

**Would NOT use:** social-media-stream features. Activity feed in the app. Anything that feels like Instagram. Pure pretty-photo features without underlying data.

---

## Persona 2 — Sydney, the Spring-Planner Hobbyist

**Demographic:** 32, suburban Southern California; mostly solo gardener with a partner who occasionally helps. Mixed garden: in-ground vegetable beds, fruit trees (orchard), roses, container plants.

**Gardening experience + scale:** 4-6 years; learning every season. Spring planning intensive (December seed-buying through April plant-out); summer maintenance; fall reflection. Tracks 30-60 seed packets, 40-80 active plants at peak.

**Primary goals from the app:**
- Plan each season's plantings before spring rush
- Track each plant's care (watering, fertilizing, pest treatment)
- Long-term memory across seasons ("did I successfully overwinter the rosemary?")
- Coordinate with sister (occasional swaps + comparing notes)
- Pest ID and treatment guidance (long-term issues like aphids on roses)

**Friction points:**
- Too many features at once ("data fatigue")
- Aesthetic incoherence (cards that look slightly different surface to surface)
- Tasks that pile up without good filtering (calendar overload)
- Information that's there but hard to find ("lost" feeling)

**Tech comfort:** Medium. Uses iPhone + laptop. Comfortable with long-press, swipe, multi-step flows BUT prefers clean obvious-next-step UX over hidden depth.

**Representative quote:** *"I just want the app to feel coherent. Like one product, not a bunch of pages stitched together. And don't make me re-figure-out how to do something I did last month."*

**Would NOT use:** complex permission tiers; commercial / marketplace features; pure social-engagement features.

---

## Persona 3 — Walter, the Retiree Gardener

**Demographic:** 68, retired schoolteacher, mid-size suburban yard in the Pacific Northwest; lives with wife (also a gardener). Grows tomatoes, dahlias, herbs, plus fruit trees passed down from his father.

**Gardening experience + scale:** 40+ years gardening from childhood. Doesn't think of himself as "experienced" because he learned by watching his parents. Manages 50-100 plants total across multiple beds, mostly perennial / repeating annuals.

**Primary goals from the app:**
- Remember when to do specific tasks ("when did I prune the apple last?")
- Track which plants are doing well ("the tomatoes in the back bed are slower")
- Share his garden info with his daughter (who's also a gardener)
- Avoid losing track of seedlings he started

**Friction points:**
- Tiny text or touch targets
- Hidden gestures (he might not know to long-press; needs visible buttons)
- Jargon ("disclosure-by-data" means nothing to him)
- Apps that require lots of clicks to do simple things
- Multiple permission tiers / sharing complexity

**Tech comfort:** Low-to-medium. Uses iPad almost exclusively (easier on his eyes). Family helped him set the app up. Will not figure out non-obvious gestures.

**Representative quote:** *"Just tell me what to do and when. Big buttons. Plain words. I shouldn't have to figure out which menu the thing I want is in."*

**Would NOT use:** swipe gestures (will tap if available); complex filters; multi-step forms.

---

## Persona 4 — Aria, the Houseplant Urban User

**Demographic:** 28, lives in a 1-bedroom apartment in a major city; works in marketing. No outdoor space. Plants live on windowsills, side tables, and a small balcony.

**Gardening experience + scale:** 3 years of houseplant collecting; 8-15 plants total. Focus: indoor humidity, watering schedules, pest spotting (spider mites, fungus gnats). Occasionally trades cuttings with friends.

**Primary goals from the app:**
- Track watering schedule (different plants need different cadences)
- Identify and treat pests
- Remember which plant came from where (gift, propagation, swap)
- Save plant photos as growth tracking

**Friction points:**
- Features she doesn't use cluttering UI (harvest tracking, planting calendar, seed packets)
- Outdoor-garden assumptions ("when to plant out" doesn't apply to her)
- Empty states that scold her ("you haven't logged a harvest!")
- Required fields she can't fill (e.g. "bed location" if she has no beds)

**Tech comfort:** High. iPhone-native; expects iOS standard interactions. Knows long-press, swipe, share-sheet patterns.

**Representative quote:** *"I'm not a 'real' gardener — I just have plants. Don't make me feel weird for not having an outdoor garden."*

**Would NOT use:** harvest tracking; seed-batch features; orchard/tree features. Bed-as-entity won't apply to her. May or may not use trade/share features (she does propagate cuttings).

---

## Persona 5 — Sam, the First-Time Beginner

**Demographic:** Two flavors: (a) 24, just moved into a place with a small patch of dirt, inspired by a TikTok video to grow tomatoes; OR (b) 55, empty-nester, finally has time to try gardening.

**Gardening experience + scale:** Zero to a few weeks. 1-3 plants. Doesn't yet know what they don't know.

**Primary goals from the app:**
- "How do I keep this plant alive?"
- Reminders for the basics (water, sun, when to start worrying)
- Plain-language guidance ("yellow leaves usually mean...")
- Eventually: pride in seeing growth over time

**Friction points:**
- Empty-state cliffs ("here are 47 features you don't need yet")
- Jargon ("true leaves" / "hardening off" / "transplant shock")
- Pre-filled fields that confuse them (calendar showing tasks for plants they don't have)
- Features that assume scale they don't have (batch tracking, multiple beds, harvest yield)

**Tech comfort:** Variable. 24yo flavor: high. 55yo new-gardener flavor: medium. Both share: a willingness to learn ONE app well, IF the first 5 minutes feel safe.

**Representative quote:** *"I just want to not kill this plant. Show me when to water, tell me what's wrong if something looks wrong, and we'll go from there."*

**Would NOT use:** advanced features (germination rate, batch operations, multi-season comparison). Doesn't know they exist. Will discover slowly via disclosure-by-data.

---

## Cross-persona quick-scan

| Concern | Maya | Sydney | Walter | Aria | Sam |
|---|---|---|---|---|---|
| Outdoor garden | ✅ Large | ✅ Mixed | ✅ Mid | ❌ None (balcony only) | Variable |
| Seed / batch features | ✅ Critical | ✅ Yes | ⚠️ Sometimes | ❌ Rarely | ❌ Skip |
| Harvest tracking | ✅ Yes | ✅ Yes | ⚠️ Some | ❌ No | ❌ Not yet |
| Sharing / trading | ✅ Yes (multi-group) | ✅ Yes (sister) | ✅ Yes (daughter) | ⚠️ Cuttings only | ❌ Not yet |
| Tech comfort | High | Medium-high | Low-medium | High | Variable |
| Onboarding need | None | Light | Medium | Light | Heavy |
| Disclosure-by-data preference | High | High | Medium | High | Heavy |

---

## Maintenance

Update this file when:
- A new persona category emerges from real user feedback
- Existing personas need refinement after seeing real usage patterns
- The product's scope changes in a way that creates a new "edge user"

Locked roster (2026-05-17). Adjust by user direction; don't add personas during plan-audit work — capture as a separate decision in a follow-up chat.
