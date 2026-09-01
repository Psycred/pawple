-- PAW-100 Phase 1a: introduction chat link-sharing block (additive only).
-- Authority: docs/PAWPLE_PHASE1A_CTO_ARCHITECTURE.md §3.4
--
-- Mutual-Paw-only chat is already enforced by mating_introduction_channels RLS +
-- mating_introduction_messages INSERT policy (open channel + live mutual Paw).
-- This migration adds fail-closed URL rejection at INSERT time.
--
-- Phone numbers remain allowed (organic exchange per Founder / CURRENT.md).
-- Does NOT modify mating_paw_interest_chat.sql or mating radius migration.

-- =============================================================================
-- 1) Link detection helper (immutable — safe for trigger + future reuse)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.introduction_message_body_contains_link(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    -- Explicit protocol or www prefix
    coalesce(trim(p_body), '') ~* '(https?://|www\.)'
    -- Bare domain + common TLD (word-bounded; avoids phone-style dotted numbers)
    OR coalesce(trim(p_body), '') ~* E'\\m[a-z0-9][a-z0-9\\-]{0,62}\\.(com|org|net|io|co|in|uk|app|dev|me|info|biz|edu|gov|tv|xyz|online|site|store|shop|link|click|live|tech|cloud|ai)([\\s/?#]|\\M)';
$$;

COMMENT ON FUNCTION public.introduction_message_body_contains_link(text) IS
  'True when introduction chat body appears to contain a shareable URL. Phone numbers are not matched. PAW-100.';

-- =============================================================================
-- 2) BEFORE INSERT trigger — reject links before RLS-visible row exists
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mating_introduction_message_reject_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.introduction_message_body_contains_link(NEW.body) THEN
    RAISE EXCEPTION 'link_sharing_forbidden'
      USING ERRCODE = 'P0001',
            HINT = 'Links cannot be shared in introduction chat.';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.mating_introduction_message_reject_links() IS
  'PAW-100: fail-closed link block on mating_introduction_messages INSERT.';

DROP TRIGGER IF EXISTS trg_mating_introduction_messages_reject_links
  ON public.mating_introduction_messages;

CREATE TRIGGER trg_mating_introduction_messages_reject_links
  BEFORE INSERT ON public.mating_introduction_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mating_introduction_message_reject_links();
