-- Logic & Leaf foundation: packable leaves + hammer refine/shard workflow
-- Compatible with current Voyager Sanctuary schema and RPC usage.

-- 1) Overload: mountain-scoped packable candidates
-- Keeps existing app RPC (`get_packable_candidates(p_user_id, p_limit, p_exclude_ids)`) intact.
CREATE OR REPLACE FUNCTION get_packable_candidates(
  p_user_id UUID,
  p_mountain_id UUID,
  p_limit INT DEFAULT 10,
  p_exclude_ids UUID[] DEFAULT '{}'
)
RETURNS SETOF nodes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n1.*
  FROM nodes n1
  WHERE n1.user_id = p_user_id
    AND n1.mountain_id = p_mountain_id
    AND n1.is_complete = false
    AND n1.is_archived = false
    -- Leaf-only: no descendants at any deeper level
    AND NOT EXISTS (
      SELECT 1
      FROM nodes n2
      WHERE n2.user_id = p_user_id
        AND n2.mountain_id = p_mountain_id
        AND n2.id <> n1.id
        AND n2.path <@ n1.path
    )
    AND NOT EXISTS (
      SELECT 1
      FROM satchel_slots ss
      WHERE ss.user_id = p_user_id
        AND ss.node_id = n1.id
    )
    AND (p_exclude_ids IS NULL OR NOT (n1.id = ANY(p_exclude_ids)))
  ORDER BY n1.is_starred DESC NULLS LAST, n1.due_date ASC NULLS LAST, n1.created_at ASC
  LIMIT p_limit;
$$;

-- 2) Hammer refine RPC: split a stone into child shards,
-- inherit metadata, remove parent from Satchel, and repack new shards if room exists.
CREATE OR REPLACE FUNCTION refine_stone_into_shards(
  p_parent_id UUID,
  p_shard_names TEXT[],
  p_return_to_satchel BOOLEAN DEFAULT true
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent nodes%ROWTYPE;
  v_name TEXT;
  v_slug TEXT;
  v_new_id UUID;
  v_ids UUID[] := '{}';
BEGIN
  SELECT *
  INTO v_parent
  FROM nodes
  WHERE id = p_parent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent node % not found', p_parent_id;
  END IF;

  -- Guardrail: only incomplete, non-archived leaf nodes may be refined.
  IF v_parent.is_complete OR v_parent.is_archived THEN
    RAISE EXCEPTION 'Cannot refine completed/archived node %', p_parent_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM nodes c
    WHERE c.user_id = v_parent.user_id
      AND c.mountain_id = v_parent.mountain_id
      AND c.id <> v_parent.id
      AND c.path <@ v_parent.path
  ) THEN
    RAISE EXCEPTION 'Cannot refine non-leaf node %', p_parent_id;
  END IF;

  -- Remove parent from Satchel (if present).
  UPDATE satchel_slots
  SET node_id = NULL,
      packed_at = now(),
      ready_to_burn = false
  WHERE user_id = v_parent.user_id
    AND node_id = v_parent.id;

  FOREACH v_name IN ARRAY p_shard_names LOOP
    v_name := btrim(coalesce(v_name, ''));
    IF v_name = '' THEN
      CONTINUE;
    END IF;

    -- ltree-safe slug + unique suffix to avoid collisions
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9_]+', '_', 'g'));
    v_slug := regexp_replace(v_slug, '^_+|_+$', '', 'g');
    IF v_slug = '' THEN
      v_slug := 'shard';
    END IF;

    v_new_id := gen_random_uuid();

    INSERT INTO nodes (
      id,
      user_id,
      mountain_id,
      path,
      node_type,
      title,
      order_index,
      is_starred,
      due_date,
      is_complete,
      completed_at,
      is_pending_ritual,
      is_archived
    ) VALUES (
      v_new_id,
      v_parent.user_id,
      v_parent.mountain_id,
      v_parent.path || (v_slug || '_' || substr(replace(v_new_id::text, '-', ''), 1, 8))::ltree,
      'shard',
      v_name,
      0,
      v_parent.is_starred,
      v_parent.due_date,
      false,
      NULL,
      true,
      false
    );

    v_ids := array_append(v_ids, v_new_id);
  END LOOP;

  -- Re-pack new shards into first empty Satchel slots.
  IF p_return_to_satchel AND coalesce(array_length(v_ids, 1), 0) > 0 THEN
    WITH empties AS (
      SELECT id AS slot_id,
             row_number() OVER (ORDER BY slot_index) AS rn
      FROM satchel_slots
      WHERE user_id = v_parent.user_id
        AND (node_id IS NULL OR trim(coalesce(node_id::text, '')) = '')
      ORDER BY slot_index
    ),
    shards AS (
      SELECT shard_id,
             row_number() OVER () AS rn
      FROM unnest(v_ids) AS shard_id
    )
    UPDATE satchel_slots ss
    SET node_id = s.shard_id,
        packed_at = now(),
        ready_to_burn = false
    FROM empties e
    JOIN shards s ON s.rn = e.rn
    WHERE ss.id = e.slot_id
      AND ss.user_id = v_parent.user_id;
  END IF;

  RETURN v_ids;
END;
$$;

-- 3) Optional helper alias for single-shard create call sites.
CREATE OR REPLACE FUNCTION create_shard_under_parent(
  p_parent_id UUID,
  p_shard_name TEXT,
  p_return_to_satchel BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  v_ids := refine_stone_into_shards(p_parent_id, ARRAY[p_shard_name], p_return_to_satchel);
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No shard created for parent %', p_parent_id;
  END IF;
  RETURN v_ids[1];
END;
$$;