-- Allow pet-profile reports (Discover pre-Paw and other pet-profile surfaces).
-- mating_interest remains reserved for paw_interests.id targets.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('moment', 'meetup', 'mating_interest', 'introduction_chat', 'pet'));

COMMENT ON TABLE public.reports IS
  'Phase-1 user reports. Targets: moment | meetup | mating_interest | introduction_chat | pet. Filed as a pet; flags reported_user_id. Team review via service_role. No AI scanning.';
