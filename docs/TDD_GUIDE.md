# Test Driven Development (TDD) — Guide for Garden Tracker

A practical guide to TDD in this project, written for people who aren’t full-time software developers.

---

## What is TDD in one sentence?

**You write a failing test first, then write the smallest amount of code to make it pass, then tidy up.** You repeat this cycle for each behavior.

---

## The TDD cycle (Red → Green → Refactor)

1. **Red** — Write a test that describes what you want (e.g. “when I pass a date, it returns the right season”). Run it. It should **fail** because the code doesn’t do that yet.
2. **Green** — Write the simplest code that makes that test **pass**. Don’t add extra features.
3. **Refactor** — Improve the code (names, structure, remove duplication) while keeping the tests green.

Then repeat for the next behavior.

---

## Why use TDD?

- **Safety net** — Change code later without silently breaking behavior; tests tell you.
- **Clear requirements** — Tests force you to decide “what should this do?” before “how.”
- **Easier debugging** — When something breaks, a failing test points to the exact behavior that broke.
- **Living documentation** — Tests show how functions and components are supposed to be used.

---

## What to test (and what not to)

### Good candidates for TDD in this project

| What | Why |
|------|-----|
| **`lib/` utilities** (e.g. `canonicalKey.ts`, `parseSeedFromQR.ts`, `htmlEntities.ts`) | Pure logic, no UI or DB; easy and fast to test. |
| **API route handlers** (e.g. `/api/seed/extract/route.ts`) | You can test “given this request, I get this response” without clicking in the app. |
| **Data transforms** (e.g. converting scraped data into your types) | Again, mostly logic; tests prevent regressions when you change formats. |
| **Small, focused components** (e.g. `TagBadges`, form helpers) | You can test “renders this when given this props” and “calls this when clicked.” |

### Harder or less useful to test first

- **Full pages** — Heavy with layout, auth, data loading; better to add tests after the page works.
- **Things that only talk to Supabase** — Need mocks or a test DB; start with unit tests for the logic that prepares data or handles responses.
- **Third‑party integrations** — Prefer testing your code that *uses* them, not the library itself.

**Practical approach:** Start TDD on **small `lib/` functions and API logic**. Add component tests for important UI once the flow is stable.

---

## Important things to be aware of

1. **Tests are code** — They can be wrong or outdated. If a test is confusing or fails for a bad reason, fix or delete it.
2. **One behavior per test** — Each test should answer one question: “Does X do Y when Z?” That makes failures easy to interpret.
3. **Test behavior, not implementation** — Test “when I call formatDate(x), I get ‘Jan 15, 2025’,” not “it calls toLocaleDateString.” So when you refactor, tests still make sense.
4. **Start small** — One function, one test. Get used to Red → Green → Refactor before testing big flows.
5. **You don’t need 100% coverage** — Focus on critical paths and tricky logic. Boring glue code often doesn’t need tests.

---

## How to approach TDD in this project

### Step 1: Run the test suite

**Rule: run the entire test suite whenever you implement a new feature or fix.** See [TESTING.md](../TESTING.md#when-to-run-the-test-suite) for the full policy.

From the project root:

- **Watch mode** (re-runs when you save): `npm test`
- **Single run** (e.g. before commit or for CI): `npm run test:run`
- **With coverage:** `npm run test:ci`

Use this all the time: after writing a test (expect Red), after writing code (expect Green), and after refactoring (stay Green). Before you commit or merge, the full suite must pass.

### Step 2: Pick one small behavior

Example: “I want `getCanonicalKey('Benary's Giant')` to return `'benarysgiant'` (lowercased, no spaces or punctuation).”

### Step 3: Write the test first

- Open or create a test file next to the code (e.g. `src/lib/canonicalKey.test.ts`).
- Write a test that calls `getCanonicalKey('Benary's Giant')` and expects `'benarysgiant'`.
- Run `npm test` or `npm run test:run`. The test should **fail** if the behavior isn’t there yet (Red).

### Step 4: Make it pass

- Implement (or change) the function so the test passes.
- Run the tests again. They should **pass** (Green).

### Step 5: Refactor if needed

- Rename variables, split helpers, remove duplication.
- After each change, run the tests to stay Green.

### Step 6: Repeat

- Add the next behavior with a new test, then implement, then refactor.

---

## Example: one full TDD cycle

**Behavior:** “`getCanonicalKey` lowercases and strips non-alphanumeric characters so variety names match across vendors.”

1. **Red** — In `src/lib/canonicalKey.test.ts` you write:

   ```ts
   import { describe, it, expect } from 'vitest';
   import { getCanonicalKey } from './canonicalKey';

   describe('getCanonicalKey', () => {
     it('lowercases and strips non-alphanumeric characters', () => {
       expect(getCanonicalKey("Benary's Giant")).toBe('benarysgiant');
     });
   });
   ```

   Run `npm run test:run` → test fails if the function doesn’t exist or doesn’t do this yet.

2. **Green** — In `canonicalKey.ts` you implement (or adjust) the function so the test passes.

   Run `npm run test:run` → test passes.

3. **Refactor** — Improve names or structure; run tests again to stay Green.

Later you add another test (e.g. “returns empty string for empty input”) and repeat Red → Green → Refactor.

---

## Summary

- **TDD** = write a failing test → make it pass → refactor; repeat.
- **Start with** small `lib/` functions and API logic; add UI tests for important components when it helps.
- **Run `npm test`** often and keep tests focused on one behavior.
- You don’t need to test everything—prioritize behavior that’s critical or easy to break.

Once you’re comfortable with one utility, apply the same cycle to the next function or API route.
