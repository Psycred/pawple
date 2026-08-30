-- Add the nullable onboarding completion timestamp expected by the client.
-- Invite policy and redemption behavior are intentionally outside this migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'When the user completed onboarding; NULL means onboarding is incomplete.';
