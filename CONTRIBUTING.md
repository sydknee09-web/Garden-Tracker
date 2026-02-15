# Contributing to Garden Tracker

## Before you commit

1. **Run the full test suite** — Whenever you add a feature or fix a bug, run the tests and fix any failures before committing or merging.

   ```bash
   npm run test:run
   ```

   For a single run with coverage (e.g. before a PR or in CI):

   ```bash
   npm run test:ci
   ```

2. **Do not merge or ship with failing tests** — The suite must be green. If a test is wrong or outdated, fix or remove the test; don’t leave it failing.

See **[TESTING.md](TESTING.md)** for commands, when to run tests, and how to write new tests. For TDD workflow and what to test, see **[docs/TDD_GUIDE.md](docs/TDD_GUIDE.md)**.

## Codebase rules

All changes must follow the project’s **Laws of the Vault** (data integrity, RLS, soft delete, etc.). These are summarized in the repo’s Cursor rules and in `.cursor/rules/laws-of-the-vault.mdc` if you use Cursor.
