-- Legal consent timestamps (referenced by OnboardingPetsScreen profile upsert).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_tos_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.accepted_tos_at IS 'When the user accepted Terms of Service';
COMMENT ON COLUMN public.profiles.accepted_privacy_at IS 'When the user accepted Privacy Policy';
