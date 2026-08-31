-- PAW-60 / Mating wave E3+E4: interest records, mutual Paw, introduction chat RLS.
-- Authority: docs/CURRENT.md (Mating System) · PAWPLE_MATING_DISCOVERY_SPEC rev 4 ·
-- PAW-58 mating-architecture rev 2 · PAW-57 / CEO binding QA controls.
--
-- Criteria only: same breed, opposite sex, both opted in, viewer radius.
-- No open DMs, dismiss/hide tables, match scores, or AI scanning.
-- Age 18+: fail-closed via profiles.age_attested_adult (interim until PAW-53).
-- Report targets: mating_interest | introduction_chat (CTO rev 2 vocabulary).
-- Commits held until Founder decides (CURRENT.md).

-- =============================================================================
-- 1) Mating intent fields (single opt-in column retained — Founder copy locked)
-- =============================================================================
-- Keep is_looking_for_companion as the canonical opt-in write path (no dual columns).
-- Product UI copy remains "Open to Companionship" per CURRENT.md.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS mating_description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pets_mating_description_length_check'
      AND conrelid = 'public.pets'::regclass
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_mating_description_length_check
      CHECK (mating_description IS NULL OR char_length(mating_description) <= 200);
  END IF;
END $$;

COMMENT ON COLUMN public.pets.mating_description IS
  'Short About mating text (max 200). Descriptive evaluation context only — never an eligibility criterion.';

COMMENT ON COLUMN public.pets.is_looking_for_companion IS
  'Canonical mating opt-in (Open to Companionship). Gates mating eligibility / Paw RPCs only — never feed or community RLS visibility (Honesty G).';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mating_discovery_radius_km integer NOT NULL DEFAULT 25;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_mating_discovery_radius_km_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_mating_discovery_radius_km_check
      CHECK (mating_discovery_radius_km IN (5, 10, 25, 50));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.mating_discovery_radius_km IS
  'User-selected mating discovery radius in km (5/10/25/50). Used only by mating eligibility RPCs — not meetup feed radius.';

-- Minimal durable 18+ attestation (CTO §3.1 / PAW-57 fail-closed interim until PAW-53).
-- Default false: mating-critical writes reject until the owner attests via profile UPDATE.
-- Frontend must sync AgeGateScreen success into this column; do not claim store-grade
-- age enforcement until PAW-53 durable attestation lands.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_attested_adult boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.age_attested_adult IS
  'Interim 18+ attestation for mating-critical writes (fail-closed). Not store-grade KYC; PAW-53 owns durable attestation.';

-- =============================================================================
-- 2) Helpers (security predicates)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    WHEN NOT (
      lat1 BETWEEN -90 AND 90 AND lat2 BETWEEN -90 AND 90
      AND lng1 BETWEEN -180 AND 180 AND lng2 BETWEEN -180 AND 180
    ) THEN NULL
    ELSE (
      6371.0 * 2 * asin(
        sqrt(
          power(sin(radians(lat2 - lat1) / 2), 2)
          + cos(radians(lat1)) * cos(radians(lat2))
            * power(sin(radians(lng2 - lng1) / 2), 2)
        )
      )
    )
  END;
$$;

COMMENT ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) IS
  'Great-circle distance in km. Returns NULL when any coordinate is missing/invalid — never fabricates.';

CREATE OR REPLACE FUNCTION public.pets_are_opposite_sex(gender_a text, gender_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(trim(coalesce(gender_a, ''))) IN ('male', 'female')
    AND lower(trim(coalesce(gender_b, ''))) IN ('male', 'female')
    AND lower(trim(gender_a)) <> lower(trim(gender_b));
$$;

COMMENT ON FUNCTION public.pets_are_opposite_sex(text, text) IS
  'Opposite-sex eligibility for Male/Female only. Other/unknown genders are not eligible.';

CREATE OR REPLACE FUNCTION public.pets_same_breed(breed_a text, breed_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    nullif(lower(trim(coalesce(breed_a, ''))), '') IS NOT NULL
    AND lower(trim(breed_a)) = lower(trim(coalesce(breed_b, '')));
$$;

CREATE OR REPLACE FUNCTION public.profile_location_is_fresh(updated_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT updated_at IS NOT NULL
    AND updated_at > (timezone('utc', now()) - interval '24 hours');
$$;

-- Fail-closed 18+ gate for mating-critical writes (CTO §3.1 / §4.6).
-- Rejects when attestation is missing/false. PAW-53 may harden how attestation is set.
CREATE OR REPLACE FUNCTION public.assert_mating_age_ok(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000',
            HINT = 'Sign in required for mating actions.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.age_attested_adult IS TRUE
  ) THEN
    RAISE EXCEPTION 'age_attestation_required'
      USING ERRCODE = '42501',
            HINT = 'Mating requires an 18+ attested account.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_mating_age_ok(uuid) IS
  'Fail-closed 18+ check on profiles.age_attested_adult. Mating writes reject until attested; PAW-53 owns durable attestation quality.';

CREATE OR REPLACE FUNCTION public.mating_pair_blocked_for_viewer(
  p_viewer_id uuid,
  p_other_pet_id uuid,
  p_other_owner_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Viewer blocked the other pet
    EXISTS (
      SELECT 1
      FROM public.pet_blocks b
      WHERE b.blocker_user_id = p_viewer_id
        AND b.blocked_pet_id = p_other_pet_id
    )
    -- Other owner blocked any of viewer's pets
    OR EXISTS (
      SELECT 1
      FROM public.pet_blocks b
      INNER JOIN public.pets my_pet ON my_pet.id = b.blocked_pet_id
      WHERE b.blocker_user_id = p_other_owner_id
        AND my_pet.owner_id = p_viewer_id
    );
$$;

CREATE OR REPLACE FUNCTION public.pets_have_mutual_paw(pet_x uuid, pet_y uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pet_x IS NOT NULL
    AND pet_y IS NOT NULL
    AND pet_x <> pet_y
    AND EXISTS (
      SELECT 1 FROM public.paw_interests
      WHERE from_pet_id = pet_x AND to_pet_id = pet_y
    )
    AND EXISTS (
      SELECT 1 FROM public.paw_interests
      WHERE from_pet_id = pet_y AND to_pet_id = pet_x
    );
$$;

COMMENT ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) IS
  'Derived mutuality predicate (both directional paw_interests). Not a match product object.';

REVOKE ALL ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pets_are_opposite_sex(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pets_same_breed(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_location_is_fresh(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_mating_age_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_pair_blocked_for_viewer(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.pets_have_mutual_paw(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pets_are_opposite_sex(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pets_same_breed(text, text) TO authenticated;
-- Required for RLS predicates on paw_interests / messages.
GRANT EXECUTE ON FUNCTION public.mating_pair_blocked_for_viewer(uuid, uuid, uuid) TO authenticated;

-- =============================================================================
-- 3) paw_interests — directional transparent interest
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.paw_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  to_pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  from_owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paw_interests_pair_unique UNIQUE (from_pet_id, to_pet_id),
  CONSTRAINT paw_interests_distinct_pets CHECK (from_pet_id <> to_pet_id),
  CONSTRAINT paw_interests_distinct_owners CHECK (from_owner_id <> to_owner_id)
);

-- Idempotent upgrade path if an earlier draft created the table without to_owner_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'paw_interests' AND column_name = 'to_owner_id'
  ) THEN
    ALTER TABLE public.paw_interests
      ADD COLUMN to_owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
    UPDATE public.paw_interests pi
    SET to_owner_id = p.owner_id
    FROM public.pets p
    WHERE p.id = pi.to_pet_id AND pi.to_owner_id IS NULL;
    ALTER TABLE public.paw_interests
      ALTER COLUMN to_owner_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paw_interests_distinct_owners'
      AND conrelid = 'public.paw_interests'::regclass
  ) THEN
    ALTER TABLE public.paw_interests
      ADD CONSTRAINT paw_interests_distinct_owners CHECK (from_owner_id <> to_owner_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS paw_interests_to_pet_created_idx
  ON public.paw_interests (to_pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS paw_interests_from_pet_idx
  ON public.paw_interests (from_pet_id);
CREATE INDEX IF NOT EXISTS paw_interests_from_owner_idx
  ON public.paw_interests (from_owner_id);
CREATE INDEX IF NOT EXISTS paw_interests_to_owner_idx
  ON public.paw_interests (to_owner_id);
CREATE INDEX IF NOT EXISTS paw_interests_from_owner_created_idx
  ON public.paw_interests (from_owner_id, created_at DESC);


COMMENT ON TABLE public.paw_interests IS
  'Directional mating Paw (from_pet → to_pet). Mutuality is derived. Transparent to requested pet owner. No reject/pass/hide status.';

ALTER TABLE public.paw_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paw_interests_select_participants ON public.paw_interests;
CREATE POLICY paw_interests_select_participants
  ON public.paw_interests
  FOR SELECT
  TO authenticated
  USING (
    (
      from_owner_id = auth.uid()
      OR (
        -- Transparent inbound Paw: only while the requested pet remains opted in.
        EXISTS (
          SELECT 1 FROM public.pets p
          WHERE p.id = to_pet_id
            AND p.owner_id = auth.uid()
            AND p.is_looking_for_companion IS TRUE
        )
      )
    )
    AND NOT public.mating_pair_blocked_for_viewer(
      auth.uid(),
      CASE
        WHEN from_owner_id = auth.uid() THEN to_pet_id
        ELSE from_pet_id
      END,
      CASE
        WHEN from_owner_id = auth.uid() THEN to_owner_id
        ELSE from_owner_id
      END
    )
  );

-- Direct INSERT denied for clients — writes go through express_paw RPC.
DROP POLICY IF EXISTS paw_interests_insert_deny ON public.paw_interests;
CREATE POLICY paw_interests_insert_deny
  ON public.paw_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS paw_interests_delete_own ON public.paw_interests;
CREATE POLICY paw_interests_delete_own
  ON public.paw_interests
  FOR DELETE
  TO authenticated
  USING (from_owner_id = auth.uid());

-- No UPDATE (toggle = delete + insert via RPC).
DROP POLICY IF EXISTS paw_interests_update_deny ON public.paw_interests;
CREATE POLICY paw_interests_update_deny
  ON public.paw_interests
  FOR UPDATE
  TO authenticated
  USING (false);

REVOKE ALL ON TABLE public.paw_interests FROM anon;
GRANT SELECT, DELETE ON TABLE public.paw_interests TO authenticated;
GRANT ALL ON TABLE public.paw_interests TO service_role;

-- =============================================================================
-- 4) Introduction channels + messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mating_introduction_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_low_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  pet_high_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  owner_low_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  owner_high_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  frozen_at timestamptz,
  freeze_reason text,
  CONSTRAINT mating_introduction_channels_pair_unique UNIQUE (pet_low_id, pet_high_id),
  CONSTRAINT mating_introduction_channels_pet_order CHECK (pet_low_id < pet_high_id),
  CONSTRAINT mating_introduction_channels_distinct_owners CHECK (owner_low_id <> owner_high_id),
  CONSTRAINT mating_introduction_channels_status_check CHECK (status IN ('open', 'frozen')),
  CONSTRAINT mating_introduction_channels_freeze_reason_check CHECK (
    freeze_reason IS NULL
    OR freeze_reason IN ('mutual_broken', 'block', 'opt_out', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS mating_introduction_channels_owner_low_idx
  ON public.mating_introduction_channels (owner_low_id);
CREATE INDEX IF NOT EXISTS mating_introduction_channels_owner_high_idx
  ON public.mating_introduction_channels (owner_high_id);
CREATE INDEX IF NOT EXISTS mating_introduction_channels_status_idx
  ON public.mating_introduction_channels (status);

COMMENT ON TABLE public.mating_introduction_channels IS
  'Consent-gated mating introduction channel for an ordered pet pair. Created only by server on mutual Paw. Not open DMs.';

CREATE TABLE IF NOT EXISTS public.mating_introduction_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.mating_introduction_channels (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mating_introduction_messages_body_check CHECK (
    char_length(trim(body)) BETWEEN 1 AND 2000
  )
);

CREATE INDEX IF NOT EXISTS mating_introduction_messages_channel_created_idx
  ON public.mating_introduction_messages (channel_id, created_at);

COMMENT ON TABLE public.mating_introduction_messages IS
  'Text-only introduction messages. INSERT requires open channel + live mutual Paw (RLS double-gate). No attachments in Phase 1.';

ALTER TABLE public.mating_introduction_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mating_introduction_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mating_introduction_channels_select_participants ON public.mating_introduction_channels;
CREATE POLICY mating_introduction_channels_select_participants
  ON public.mating_introduction_channels
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (owner_low_id, owner_high_id));

-- No client INSERT/UPDATE/DELETE on channels — trigger / SECURITY DEFINER only.
DROP POLICY IF EXISTS mating_introduction_channels_insert_deny ON public.mating_introduction_channels;
CREATE POLICY mating_introduction_channels_insert_deny
  ON public.mating_introduction_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS mating_introduction_channels_update_deny ON public.mating_introduction_channels;
CREATE POLICY mating_introduction_channels_update_deny
  ON public.mating_introduction_channels
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS mating_introduction_channels_delete_deny ON public.mating_introduction_channels;
CREATE POLICY mating_introduction_channels_delete_deny
  ON public.mating_introduction_channels
  FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS mating_introduction_messages_select_participants ON public.mating_introduction_messages;
CREATE POLICY mating_introduction_messages_select_participants
  ON public.mating_introduction_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mating_introduction_channels c
      WHERE c.id = channel_id
        AND auth.uid() IN (c.owner_low_id, c.owner_high_id)
    )
  );

DROP POLICY IF EXISTS mating_introduction_messages_insert_mutual_open ON public.mating_introduction_messages;
CREATE POLICY mating_introduction_messages_insert_mutual_open
  ON public.mating_introduction_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.age_attested_adult IS TRUE
    )
    AND EXISTS (
      SELECT 1
      FROM public.mating_introduction_channels c
      WHERE c.id = channel_id
        AND auth.uid() IN (c.owner_low_id, c.owner_high_id)
        AND c.status = 'open'
        AND public.pets_have_mutual_paw(c.pet_low_id, c.pet_high_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.pet_blocks b
          WHERE (
            b.blocker_user_id = c.owner_low_id
            AND b.blocked_pet_id = c.pet_high_id
          )
          OR (
            b.blocker_user_id = c.owner_high_id
            AND b.blocked_pet_id = c.pet_low_id
          )
        )
    )
  );

DROP POLICY IF EXISTS mating_introduction_messages_update_deny ON public.mating_introduction_messages;
CREATE POLICY mating_introduction_messages_update_deny
  ON public.mating_introduction_messages
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS mating_introduction_messages_delete_deny ON public.mating_introduction_messages;
CREATE POLICY mating_introduction_messages_delete_deny
  ON public.mating_introduction_messages
  FOR DELETE
  TO authenticated
  USING (false);

REVOKE ALL ON TABLE public.mating_introduction_channels FROM anon;
REVOKE ALL ON TABLE public.mating_introduction_messages FROM anon;
GRANT SELECT ON TABLE public.mating_introduction_channels TO authenticated;
GRANT SELECT, INSERT ON TABLE public.mating_introduction_messages TO authenticated;
GRANT ALL ON TABLE public.mating_introduction_channels TO service_role;
GRANT ALL ON TABLE public.mating_introduction_messages TO service_role;

-- =============================================================================
-- 5) Channel lifecycle triggers (mutual open / freeze)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_sync_channel_after_paw_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
  v_owner_low uuid;
  v_owner_high uuid;
  v_from_owner uuid;
  v_to_owner uuid;
BEGIN
  IF NOT public.pets_have_mutual_paw(NEW.from_pet_id, NEW.to_pet_id) THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_from_owner FROM public.pets WHERE id = NEW.from_pet_id;
  SELECT owner_id INTO v_to_owner FROM public.pets WHERE id = NEW.to_pet_id;

  IF v_from_owner IS NULL OR v_to_owner IS NULL OR v_from_owner = v_to_owner THEN
    RETURN NEW;
  END IF;

  IF NEW.from_pet_id < NEW.to_pet_id THEN
    v_low := NEW.from_pet_id;
    v_high := NEW.to_pet_id;
    v_owner_low := v_from_owner;
    v_owner_high := v_to_owner;
  ELSE
    v_low := NEW.to_pet_id;
    v_high := NEW.from_pet_id;
    v_owner_low := v_to_owner;
    v_owner_high := v_from_owner;
  END IF;

  -- Blocked pairs do not unlock.
  IF public.mating_pair_blocked_for_viewer(v_from_owner, NEW.to_pet_id, v_to_owner)
     OR public.mating_pair_blocked_for_viewer(v_to_owner, NEW.from_pet_id, v_from_owner) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mating_introduction_channels (
    pet_low_id, pet_high_id, owner_low_id, owner_high_id,
    status, opened_at, frozen_at, freeze_reason
  )
  VALUES (
    v_low, v_high, v_owner_low, v_owner_high,
    'open', timezone('utc', now()), NULL, NULL
  )
  ON CONFLICT (pet_low_id, pet_high_id) DO UPDATE
  SET
    status = 'open',
    frozen_at = NULL,
    freeze_reason = NULL,
    -- Preserve original opened_at on quiet re-open.
    owner_low_id = EXCLUDED.owner_low_id,
    owner_high_id = EXCLUDED.owner_high_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paw_interests_sync_channel_insert ON public.paw_interests;
CREATE TRIGGER trg_paw_interests_sync_channel_insert
  AFTER INSERT ON public.paw_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_sync_channel_after_paw_insert();

CREATE OR REPLACE FUNCTION public.mating_freeze_channel_after_paw_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low uuid;
  v_high uuid;
BEGIN
  IF OLD.from_pet_id < OLD.to_pet_id THEN
    v_low := OLD.from_pet_id;
    v_high := OLD.to_pet_id;
  ELSE
    v_low := OLD.to_pet_id;
    v_high := OLD.from_pet_id;
  END IF;

  IF NOT public.pets_have_mutual_paw(OLD.from_pet_id, OLD.to_pet_id) THEN
    UPDATE public.mating_introduction_channels
    SET
      status = 'frozen',
      frozen_at = timezone('utc', now()),
      freeze_reason = 'mutual_broken'
    WHERE pet_low_id = v_low
      AND pet_high_id = v_high
      AND status = 'open';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_paw_interests_freeze_channel_delete ON public.paw_interests;
CREATE TRIGGER trg_paw_interests_freeze_channel_delete
  AFTER DELETE ON public.paw_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_freeze_channel_after_paw_delete();

CREATE OR REPLACE FUNCTION public.mating_on_pet_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_looking_for_companion IS TRUE AND NEW.is_looking_for_companion IS FALSE THEN
    -- Outbound only (CTO §3.1). Inbound retained for report evidence; Interest SELECT quiets them.
    DELETE FROM public.paw_interests
    WHERE from_pet_id = NEW.id;

    UPDATE public.mating_introduction_channels
    SET
      status = 'frozen',
      frozen_at = timezone('utc', now()),
      freeze_reason = 'opt_out'
    WHERE (pet_low_id = NEW.id OR pet_high_id = NEW.id)
      AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pets_mating_opt_out ON public.pets;
CREATE TRIGGER trg_pets_mating_opt_out
  AFTER UPDATE OF is_looking_for_companion ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_on_pet_opt_out();

-- Fail-closed: opting a pet into mating requires 18+ attestation on the owner.
CREATE OR REPLACE FUNCTION public.mating_assert_age_on_opt_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_looking_for_companion IS TRUE
     AND coalesce(OLD.is_looking_for_companion, false) IS DISTINCT FROM TRUE THEN
    PERFORM public.assert_mating_age_ok(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pets_mating_age_on_opt_in ON public.pets;
CREATE TRIGGER trg_pets_mating_age_on_opt_in
  BEFORE INSERT OR UPDATE OF is_looking_for_companion ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_assert_age_on_opt_in();

CREATE OR REPLACE FUNCTION public.mating_freeze_channels_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mating_introduction_channels c
  SET
    status = 'frozen',
    frozen_at = timezone('utc', now()),
    freeze_reason = 'block'
  WHERE c.status = 'open'
    AND (c.pet_low_id = NEW.blocked_pet_id OR c.pet_high_id = NEW.blocked_pet_id)
    AND (c.owner_low_id = NEW.blocker_user_id OR c.owner_high_id = NEW.blocker_user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pet_blocks_freeze_mating_channels ON public.pet_blocks;
CREATE TRIGGER trg_pet_blocks_freeze_mating_channels
  AFTER INSERT ON public.pet_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_freeze_channels_on_block();

-- Unblock restores chat only when mutual Paw still exists and no block remains
-- (CTO §5.2). Quiet — no celebration entity.

CREATE OR REPLACE FUNCTION public.mating_try_reopen_after_unblock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mating_introduction_channels c
  SET
    status = 'open',
    frozen_at = NULL,
    freeze_reason = NULL
  WHERE c.status = 'frozen'
    AND c.freeze_reason = 'block'
    AND (c.pet_low_id = OLD.blocked_pet_id OR c.pet_high_id = OLD.blocked_pet_id)
    AND (c.owner_low_id = OLD.blocker_user_id OR c.owner_high_id = OLD.blocker_user_id)
    AND public.pets_have_mutual_paw(c.pet_low_id, c.pet_high_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.pet_blocks b
      WHERE (
        b.blocker_user_id = c.owner_low_id AND b.blocked_pet_id = c.pet_high_id
      ) OR (
        b.blocker_user_id = c.owner_high_id AND b.blocked_pet_id = c.pet_low_id
      )
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pet_blocks_reopen_mating_channels ON public.pet_blocks;
CREATE TRIGGER trg_pet_blocks_reopen_mating_channels
  AFTER DELETE ON public.pet_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_try_reopen_after_unblock();

-- =============================================================================
-- 6) Eligibility + Paw write RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_eligible_pair(
  p_from_pet_id uuid,
  p_to_pet_id uuid,
  p_viewer_lat double precision,
  p_viewer_lng double precision,
  p_viewer_loc_fresh boolean,
  p_radius_km integer,
  OUT ok boolean,
  OUT distance_km double precision,
  OUT deny_reason text
)
RETURNS record
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.pets%ROWTYPE;
  v_to public.pets%ROWTYPE;
  v_to_lat double precision;
  v_to_lng double precision;
  v_to_fresh boolean;
  v_dist double precision;
BEGIN
  ok := false;
  distance_km := NULL;
  deny_reason := NULL;

  SELECT * INTO v_from FROM public.pets WHERE id = p_from_pet_id;
  SELECT * INTO v_to FROM public.pets WHERE id = p_to_pet_id;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    deny_reason := 'pet_not_found';
    RETURN;
  END IF;

  IF v_from.id = v_to.id THEN
    deny_reason := 'same_pet';
    RETURN;
  END IF;

  IF v_from.owner_id = v_to.owner_id THEN
    deny_reason := 'same_owner';
    RETURN;
  END IF;

  IF v_from.is_looking_for_companion IS NOT TRUE THEN
    deny_reason := 'viewer_not_opted_in';
    RETURN;
  END IF;

  IF v_to.is_looking_for_companion IS NOT TRUE THEN
    deny_reason := 'candidate_not_opted_in';
    RETURN;
  END IF;

  IF NOT public.pets_same_breed(v_from.breed, v_to.breed) THEN
    deny_reason := 'breed';
    RETURN;
  END IF;

  IF NOT public.pets_are_opposite_sex(v_from.gender, v_to.gender) THEN
    deny_reason := 'sex';
    RETURN;
  END IF;

  IF public.mating_pair_blocked_for_viewer(v_from.owner_id, v_to.id, v_to.owner_id) THEN
    deny_reason := 'blocked';
    RETURN;
  END IF;

  IF NOT p_viewer_loc_fresh OR p_viewer_lat IS NULL OR p_viewer_lng IS NULL THEN
    deny_reason := 'viewer_location_stale';
    RETURN;
  END IF;

  SELECT pr.last_location_lat, pr.last_location_lng,
         public.profile_location_is_fresh(pr.location_updated_at)
  INTO v_to_lat, v_to_lng, v_to_fresh
  FROM public.profiles pr
  WHERE pr.id = v_to.owner_id;

  IF NOT coalesce(v_to_fresh, false) OR v_to_lat IS NULL OR v_to_lng IS NULL THEN
    deny_reason := 'candidate_location_stale';
    RETURN;
  END IF;

  v_dist := public.haversine_km(p_viewer_lat, p_viewer_lng, v_to_lat, v_to_lng);
  IF v_dist IS NULL THEN
    deny_reason := 'distance_unavailable';
    RETURN;
  END IF;

  IF v_dist > p_radius_km THEN
    deny_reason := 'out_of_radius';
    RETURN;
  END IF;

  ok := true;
  distance_km := round(v_dist::numeric, 1)::double precision;
  deny_reason := NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mating_opportunities(viewer_pet_id uuid)
RETURNS TABLE (
  pet_id uuid,
  name text,
  breed text,
  gender text,
  age text,
  photo_url text,
  bio text,
  mating_description text,
  traits jsonb,
  is_looking_for_companion boolean,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_viewer public.pets%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_fresh boolean;
  v_radius integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.assert_mating_age_ok(v_uid);

  SELECT * INTO v_viewer
  FROM public.pets p
  WHERE p.id = viewer_pet_id;

  IF v_viewer.id IS NULL OR v_viewer.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet'
      USING ERRCODE = '42501',
            HINT = 'You may only explore mating for pets you own.';
  END IF;

  IF v_viewer.is_looking_for_companion IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT
    pr.last_location_lat,
    pr.last_location_lng,
    public.profile_location_is_fresh(pr.location_updated_at),
    coalesce(pr.mating_discovery_radius_km, 25)
  INTO v_lat, v_lng, v_fresh, v_radius
  FROM public.profiles pr
  WHERE pr.id = v_uid;

  IF NOT coalesce(v_fresh, false) THEN
    -- Honest scarcity: no fabricated in-range list when location is stale/missing.
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.breed,
    c.gender,
    c.age,
    c.photo_url,
    c.bio,
    c.mating_description,
    c.traits,
    c.is_looking_for_companion,
    el.distance_km
  FROM public.pets c
  CROSS JOIN LATERAL public.mating_eligible_pair(
    v_viewer.id, c.id, v_lat, v_lng, v_fresh, v_radius
  ) el
  WHERE c.id <> v_viewer.id
    AND el.ok IS TRUE
  ORDER BY el.distance_km ASC NULLS LAST, c.created_at DESC NULLS LAST, c.id;
END;
$$;

COMMENT ON FUNCTION public.get_mating_opportunities(uuid) IS
  'Server-authoritative mating discovery for an owned opted-in pet. Criteria: breed, opposite sex, opt-in, radius. Returns approximate distance_km only when honest. Never returns raw coordinates.';

CREATE OR REPLACE FUNCTION public.express_paw(from_pet_id uuid, to_pet_id uuid)
RETURNS public.paw_interests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from public.pets%ROWTYPE;
  v_to public.pets%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_fresh boolean;
  v_radius integer;
  v_el record;
  v_recent integer;
  v_row public.paw_interests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.assert_mating_age_ok(v_uid);

  SELECT * INTO v_from FROM public.pets WHERE id = from_pet_id;
  SELECT * INTO v_to FROM public.pets WHERE id = to_pet_id;

  IF v_from.id IS NULL OR v_from.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_pet' USING ERRCODE = '42501';
  END IF;

  IF v_to.id IS NULL THEN
    RAISE EXCEPTION 'pet_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Harassment mitigation: soft rate limit (transparent Paw retained).
  SELECT count(*)::integer INTO v_recent
  FROM public.paw_interests pi
  WHERE pi.from_owner_id = v_uid
    AND pi.created_at > timezone('utc', now()) - interval '1 hour';

  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'paw_rate_limited'
      USING ERRCODE = 'P0001',
            HINT = 'Take a pause before expressing more interest.';
  END IF;

  SELECT
    pr.last_location_lat,
    pr.last_location_lng,
    public.profile_location_is_fresh(pr.location_updated_at),
    coalesce(pr.mating_discovery_radius_km, 25)
  INTO v_lat, v_lng, v_fresh, v_radius
  FROM public.profiles pr
  WHERE pr.id = v_uid;

  SELECT * INTO v_el
  FROM public.mating_eligible_pair(
    from_pet_id, to_pet_id, v_lat, v_lng, coalesce(v_fresh, false), v_radius
  );

  IF v_el.ok IS NOT TRUE THEN
    RAISE EXCEPTION 'not_eligible'
      USING ERRCODE = 'P0001',
            HINT = coalesce(v_el.deny_reason, 'not_eligible');
  END IF;

  INSERT INTO public.paw_interests (from_pet_id, to_pet_id, from_owner_id, to_owner_id)
  VALUES (from_pet_id, to_pet_id, v_uid, v_to.owner_id)
  ON CONFLICT (from_pet_id, to_pet_id) DO UPDATE
  SET
    from_owner_id = EXCLUDED.from_owner_id,
    to_owner_id = EXCLUDED.to_owner_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.express_paw(uuid, uuid) IS
  'Idempotent Paw write with eligibility + same-owner + block + rate-limit checks. Prefer over direct INSERT.';

CREATE OR REPLACE FUNCTION public.withdraw_paw(from_pet_id uuid, to_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.paw_interests pi
  WHERE pi.from_pet_id = withdraw_paw.from_pet_id
    AND pi.to_pet_id = withdraw_paw.to_pet_id
    AND pi.from_owner_id = v_uid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.withdraw_paw(uuid, uuid) IS
  'Removes directional interest. Freezes introduction channel when mutuality breaks.';

REVOKE ALL ON FUNCTION public.get_mating_opportunities(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.express_paw(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_paw(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mating_eligible_pair(uuid, uuid, double precision, double precision, boolean, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_mating_opportunities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_paw(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_paw(uuid, uuid) TO authenticated;

-- =============================================================================
-- 7) Report target types — pet + mating_introduction
-- =============================================================================

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('moment', 'meetup', 'mating_interest', 'introduction_chat'));

COMMENT ON TABLE public.reports IS
  'Phase-1 user reports. Targets: moment | meetup | mating_interest | introduction_chat (CTO mating-architecture rev 2). Filed as a pet; flags reported_user_id. Team review via service_role. No AI scanning.';

-- =============================================================================
-- 8) Export + delete coverage for new tables
-- =============================================================================

CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, extensions
AS $$
DECLARE
  target_user_id uuid := auth.uid();
  profile_json jsonb;
  pets_json jsonb;
  moments_json jsonb;
  likes_json jsonb;
  invites_json jsonb;
  meetups_created_json jsonb;
  meetup_hosts_json jsonb;
  meetup_participations_json jsonb;
  mating_interest_json jsonb := '[]'::jsonb;
  mating_channels_json jsonb := '[]'::jsonb;
  mating_messages_json jsonb := '[]'::jsonb;
  storage_media_json jsonb;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000',
            HINT = 'Sign in before exporting your data.';
  END IF;

  SELECT to_jsonb(p)
  INTO profile_json
  FROM public.profiles p
  WHERE p.id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pet) ORDER BY pet.created_at NULLS LAST, pet.id), '[]'::jsonb)
  INTO pets_json
  FROM public.pets pet
  WHERE pet.owner_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.created_at NULLS LAST, m.id), '[]'::jsonb)
  INTO moments_json
  FROM public.moments m
  WHERE m.user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
  INTO likes_json
  FROM public.likes l
  WHERE l.user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  INTO invites_json
  FROM public.invites i
  WHERE i.user_id = target_user_id
     OR i.used_by_user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(mu) ORDER BY mu.created_at NULLS LAST, mu.id), '[]'::jsonb)
  INTO meetups_created_json
  FROM public.meetups mu
  WHERE mu.user_id = target_user_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(mh) ORDER BY mh.created_at NULLS LAST, mh.id),
    '[]'::jsonb
  )
  INTO meetup_hosts_json
  FROM public.meetup_hosts mh
  INNER JOIN public.pets pet ON pet.id = mh.pet_id
  WHERE pet.owner_id = target_user_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(mp) ORDER BY mp.joined_at NULLS LAST, mp.id),
    '[]'::jsonb
  )
  INTO meetup_participations_json
  FROM public.meetup_participants mp
  INNER JOIN public.pets pet ON pet.id = mp.pet_id
  WHERE pet.owner_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pi) ORDER BY pi.created_at NULLS LAST, pi.id), '[]'::jsonb)
  INTO mating_interest_json
  FROM public.paw_interests pi
  WHERE pi.from_owner_id = target_user_id
     OR pi.from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
     OR pi.to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.opened_at NULLS LAST, c.id), '[]'::jsonb)
  INTO mating_channels_json
  FROM public.mating_introduction_channels c
  WHERE c.owner_low_id = target_user_id OR c.owner_high_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.created_at NULLS LAST, m.id), '[]'::jsonb)
  INTO mating_messages_json
  FROM public.mating_introduction_messages m
  INNER JOIN public.mating_introduction_channels c ON c.id = m.channel_id
  WHERE c.owner_low_id = target_user_id OR c.owner_high_id = target_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'bucket_id', o.bucket_id,
        'path', o.name,
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      ORDER BY o.created_at NULLS LAST, o.name
    ),
    '[]'::jsonb
  )
  INTO storage_media_json
  FROM storage.objects o
  WHERE o.bucket_id IN ('moments', 'pet-photos')
    AND (storage.foldername(o.name))[1] = target_user_id::text;

  RETURN jsonb_build_object(
    'ok', true,
    'exported_at', NOW(),
    'user_id', target_user_id,
    'format', 'pawple-data-export-v1',
    'schema_version', 2,
    'profile', COALESCE(profile_json, 'null'::jsonb),
    'pets', pets_json,
    'moments', moments_json,
    'likes', likes_json,
    'invites', invites_json,
    'meetups_created', meetups_created_json,
    'meetup_hosts', meetup_hosts_json,
    'meetup_participations', meetup_participations_json,
    'mating_interest', mating_interest_json,
    'mating_introduction_channels', mating_channels_json,
    'mating_introduction_messages', mating_messages_json,
    'storage_media', storage_media_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

COMMENT ON FUNCTION public.export_user_data() IS
  'Product Contract §10 Export: JSON archive of caller-owned data including paw_interests and mating introduction channels/messages. Frontend: supabase.rpc(''export_user_data'').';

-- Patch delete_user_account mating section: replace provisional stubs with exact schema.
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, extensions
AS $$
DECLARE
  target_user_id uuid := auth.uid();
  profile_exists boolean;
  auth_exists boolean;
  deleted_counts jsonb := '{}'::jsonb;
  storage_deleted integer := 0;
  row_count integer;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000',
            HINT = 'Sign in before deleting your account.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id)
  INTO profile_exists;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = target_user_id)
  INTO auth_exists;

  IF NOT profile_exists AND NOT auth_exists THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'user_id', target_user_id,
      'deleted_at', NOW(),
      'counts', deleted_counts
    );
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id IN ('moments', 'pet-photos')
    AND (storage.foldername(name))[1] = target_user_id::text;
  GET DIAGNOSTICS storage_deleted = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('storage_objects', storage_deleted);

  DELETE FROM public.likes
  WHERE user_id = target_user_id
     OR moment_id IN (SELECT id FROM public.moments WHERE user_id = target_user_id);
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('likes', row_count);

  IF to_regclass('public.moment_pets') IS NOT NULL THEN
    DELETE FROM public.moment_pets mp
    USING public.moments m
    WHERE mp.moment_id = m.id
      AND m.user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('moment_pets', row_count);
  END IF;

  DELETE FROM public.moments
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('moments', row_count);

  IF to_regclass('public.memories') IS NOT NULL THEN
    DELETE FROM public.memories
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('memories', row_count);
  END IF;

  IF to_regclass('public.posts') IS NOT NULL THEN
    DELETE FROM public.posts
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('posts', row_count);
  END IF;

  IF to_regclass('public.photos') IS NOT NULL THEN
    DELETE FROM public.photos
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('photos', row_count);
  END IF;

  IF to_regclass('public.meetup_history') IS NOT NULL THEN
    DELETE FROM public.meetup_history
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_history', row_count);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetup_participants'
      AND column_name = 'user_id'
  ) THEN
    DELETE FROM public.meetup_participants
    WHERE user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('meetup_participants_legacy', row_count);
  END IF;

  -- Mating introduction messages (participant-scoped), then channels, then interests.
  IF to_regclass('public.mating_introduction_messages') IS NOT NULL THEN
    DELETE FROM public.mating_introduction_messages m
    USING public.mating_introduction_channels c
    WHERE m.channel_id = c.id
      AND (c.owner_low_id = target_user_id OR c.owner_high_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('mating_introduction_messages', row_count);
  END IF;

  IF to_regclass('public.mating_introduction_channels') IS NOT NULL THEN
    DELETE FROM public.mating_introduction_channels
    WHERE owner_low_id = target_user_id OR owner_high_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('mating_introduction_channels', row_count);
  END IF;

  IF to_regclass('public.paw_interests') IS NOT NULL THEN
    DELETE FROM public.paw_interests
    WHERE from_owner_id = target_user_id
       OR from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id)
       OR to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = target_user_id);
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('paw_interests', row_count);
  END IF;

  IF to_regclass('public.reports') IS NOT NULL THEN
    DELETE FROM public.reports
    WHERE reporter_user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('reports_filed', row_count);
  END IF;

  IF to_regclass('public.pet_blocks') IS NOT NULL THEN
    DELETE FROM public.pet_blocks
    WHERE blocker_user_id = target_user_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('pet_blocks', row_count);
  END IF;

  DELETE FROM public.meetups
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('meetups_created', row_count);

  DELETE FROM public.pets
  WHERE owner_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('pets', row_count);

  DELETE FROM public.invites
  WHERE user_id = target_user_id
    AND status = 'unused';
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('invites_unused_deleted', row_count);

  UPDATE public.invites
  SET user_id = NULL
  WHERE user_id = target_user_id
    AND status = 'used';
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('invites_issued_anonymized', row_count);

  UPDATE public.invites
  SET used_by_user_id = NULL
  WHERE used_by_user_id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('invites_redeemed_anonymized', row_count);

  DELETE FROM public.profiles
  WHERE id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('profiles', row_count);

  DELETE FROM auth.users
  WHERE id = target_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('auth_users', row_count);

  RETURN jsonb_build_object(
    'ok', true,
    'already_deleted', false,
    'user_id', target_user_id,
    'deleted_at', NOW(),
    'counts', deleted_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS
  'Product Contract §10 Delete: authenticated self-delete including paw_interests, mating introduction channels/messages, reports filed, and pet_blocks.';
