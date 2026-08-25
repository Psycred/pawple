-- Step 2: optional GPS coords on moments (nullable when user denies location).
alter table public.moments
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

comment on column public.moments.location_lat is 'Device latitude when moment was created (optional).';
comment on column public.moments.location_lng is 'Device longitude when moment was created (optional).';
