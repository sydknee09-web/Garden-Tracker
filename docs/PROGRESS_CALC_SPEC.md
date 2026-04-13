# Progress Calculation Spec — get_peak_progress

**Purpose:** Postgres-side progress for Peak Journal. Avoid double-counting containers; count leaves only.  
**Status:** Implementation-ready  
**Related:** [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md), [MASTER_PLAN.md](MASTER_PLAN.md)

---

## Signature

```sql
get_peak_progress(p_mountain_id UUID)
RETURNS TABLE (completed_leaves BIGINT, total_leaves BIGINT)
```

---

## Logic

- **Leaf:** Node with no direct children (same definition as Validity Filter).
- **Completed leaves:** Leaves with `is_complete = true`.
- **Total leaves:** All leaves under the mountain (complete + incomplete).

Counting leaves avoids double-counting: a pebble with 3 shards = 3 leaves, not 4.

---

## SQL Sketch

```sql
CREATE OR REPLACE FUNCTION get_peak_progress(p_mountain_id UUID)
RETURNS TABLE (completed_leaves BIGINT, total_leaves BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH leaves AS (
    SELECT n.id, n.is_complete
    FROM nodes n
    WHERE n.mountain_id = p_mountain_id
      AND NOT EXISTS (
        SELECT 1 FROM nodes c
        WHERE c.mountain_id = n.mountain_id
          AND c.path <@ n.path
          AND nlevel(c.path) = nlevel(n.path) + 1
      )
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM leaves WHERE is_complete = true),
    (SELECT COUNT(*)::BIGINT FROM leaves);
$$;
```

---

## RLS

Function runs as `SECURITY DEFINER`. Caller must pass `p_mountain_id` for a mountain they own. Add `AND user_id = auth.uid()` if needed for extra safety.

---

## Flutter Usage

- Call when loading Peak Journal for a mountain.
- Cache in Riverpod (e.g. `peakProgressProvider(mountainId)`).
- Display as "3 / 12" or progress bar.

---

**End of Progress Calc Spec.**
