-- PAW-97 / Phase 1a: account_tier schema + server-authoritative age attestation (PAW-53).
-- Authority: docs/PAWPLE_PHASE1A_CTO_ARCHITECTURE.md §3.1
--
-- Mating preserved exactly — assert_mating_age_ok delegates to assert_adult_account_ok.
-- No teen UI; teen tier exists in schema only (no client write path in Phase 1a).

-- =============================================================================
-- 1) Schema — account tier + durable attestation metadata
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'adult';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_tier_check
  CHECK (account_tier IN ('adult', 'teen'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_attested_at timestamptz;

COMMENT ON COLUMN public.profiles.account_tier IS
  'Server-authoritative account tier (adult | teen). Phase 1a: adult only via attest_adult_account RPC; teen reserved for future wave.';

COMMENT ON COLUMN public.profiles.birth_date IS
  'Date of birth set once at successful 18+ attestation. Not client-settable; immutable after attestation except service_role correction.';

COMMENT ON COLUMN public.profiles.age_attested_at IS
  'UTC timestamp when age_attested_adult was last set via server attestation path.';

-- Existing interim attestations remain valid; tier defaults to adult.
UPDATE public.profiles
SET account_tier = 'adult'
WHERE account_tier IS DISTINCT FROM 'adult'
  AND age_attested_adult IS TRUE;

-- =============================================================================
-- 2) Canonical adult assert + attestation sync (PAW-53)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assert_adult_account_ok(p_user_id uuid)
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
            HINT = 'Sign in required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.account_tier = 'adult'
      AND pr.age_attested_adult IS TRUE
  ) THEN
    RAISE EXCEPTION 'age_attestation_required'
      USING ERRCODE = '42501',
            HINT = 'An 18+ attested adult account is required.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_adult_account_ok(uuid) IS
  'Fail-closed adult account check: account_tier = adult AND age_attested_adult. Used for meetups and delegated mating asserts.';

CREATE OR REPLACE FUNCTION public.sync_age_attestation_from_birth_date(
  p_user_id uuid,
  p_birth_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.profiles%ROWTYPE;
  v_minimum_birth_date date;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF p_birth_date IS NULL THEN
    RAISE EXCEPTION 'birth_date_required'
      USING ERRCODE = '22023',
            HINT = 'A valid birth date is required.';
  END IF;

  IF p_birth_date > current_date THEN
    RAISE EXCEPTION 'birth_date_invalid'
      USING ERRCODE = '22023',
            HINT = 'Birth date cannot be in the future.';
  END IF;

  -- Whole-year age >= 18 as of current_date (calendar-day boundary).
  v_minimum_birth_date := (current_date - interval '18 years')::date;
  IF p_birth_date > v_minimum_birth_date THEN
    RAISE EXCEPTION 'underage'
      USING ERRCODE = '42501',
            HINT = 'Pawple Phase 1 requires users to be 18 or older.';
  END IF;

  SELECT * INTO v_existing
  FROM public.profiles pr
  WHERE pr.id = p_user_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found'
      USING ERRCODE = 'P0002',
            HINT = 'Complete onboarding before age attestation.';
  END IF;

  IF v_existing.age_attested_adult IS TRUE THEN
    IF v_existing.birth_date IS NOT NULL
       AND v_existing.birth_date IS DISTINCT FROM p_birth_date THEN
      RAISE EXCEPTION 'birth_date_immutable'
        USING ERRCODE = '42501',
              HINT = 'Birth date cannot be changed after attestation.';
    END IF;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    birth_date = p_birth_date,
    age_attested_adult = true,
    age_attested_at = timezone('utc', now()),
    account_tier = 'adult',
    updated_at = timezone('utc', now())
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.sync_age_attestation_from_birth_date(uuid, date) IS
  'Server-only path: validate age >= 18, set birth_date, age_attested_adult, account_tier=adult. Idempotent when already attested with same birth_date.';

CREATE OR REPLACE FUNCTION public.attest_adult_account(p_birth_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000';
  END IF;

  PERFORM public.sync_age_attestation_from_birth_date(v_uid, p_birth_date);

  RETURN jsonb_build_object(
    'ok', true,
    'account_tier', 'adult',
    'age_attested_adult', true
  );
END;
$$;

COMMENT ON FUNCTION public.attest_adult_account(date) IS
  'Client-callable 18+ attestation RPC. Replaces direct profiles UPDATE on attestation columns.';

-- Mating entry point preserved — delegates to canonical adult assert.
CREATE OR REPLACE FUNCTION public.assert_mating_age_ok(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_adult_account_ok(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.assert_mating_age_ok(uuid) IS
  'Mating-specific alias for assert_adult_account_ok. Preserves existing mating RPC/trigger call sites.';

-- =============================================================================
-- 3) Revoke client UPDATE on attestation columns (RPC-only path)
-- =============================================================================

REVOKE UPDATE (
  age_attested_adult,
  birth_date,
  account_tier,
  age_attested_at
) ON public.profiles FROM authenticated;

REVOKE UPDATE (
  age_attested_adult,
  birth_date,
  account_tier,
  age_attested_at
) ON public.profiles FROM anon;

-- =============================================================================
-- 4) Meetup + mating message age asserts (server fail-closed)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.meetup_assert_adult_on_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_adult_account_ok(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetups_assert_adult ON public.meetups;
CREATE TRIGGER trg_meetups_assert_adult
  BEFORE INSERT OR UPDATE ON public.meetups
  FOR EACH ROW
  EXECUTE FUNCTION public.meetup_assert_adult_on_write();

CREATE OR REPLACE FUNCTION public.meetup_assert_adult_on_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT p.owner_id
  INTO v_owner_id
  FROM public.pets p
  WHERE p.id = NEW.pet_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'pet_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_adult_account_ok(v_owner_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_participants_assert_adult ON public.meetup_participants;
CREATE TRIGGER trg_meetup_participants_assert_adult
  BEFORE INSERT ON public.meetup_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.meetup_assert_adult_on_participant();

CREATE OR REPLACE FUNCTION public.meetup_assert_adult_on_host()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.assert_adult_account_ok(auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetup_hosts_assert_adult ON public.meetup_hosts;
CREATE TRIGGER trg_meetup_hosts_assert_adult
  BEFORE INSERT ON public.meetup_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.meetup_assert_adult_on_host();

CREATE OR REPLACE FUNCTION public.mating_assert_adult_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_adult_account_ok(NEW.sender_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mating_introduction_messages_assert_adult ON public.mating_introduction_messages;
CREATE TRIGGER trg_mating_introduction_messages_assert_adult
  BEFORE INSERT ON public.mating_introduction_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_assert_adult_on_message();

-- Align direct-insert RLS with canonical adult assert (belt-and-suspenders).
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
        AND pr.account_tier = 'adult'
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

-- =============================================================================
-- 5) Grants
-- =============================================================================

REVOKE ALL ON FUNCTION public.assert_adult_account_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_age_attestation_from_birth_date(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attest_adult_account(date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assert_adult_account_ok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_adult_account_ok(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.sync_age_attestation_from_birth_date(uuid, date) TO service_role;

GRANT EXECUTE ON FUNCTION public.attest_adult_account(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attest_adult_account(date) TO service_role;
