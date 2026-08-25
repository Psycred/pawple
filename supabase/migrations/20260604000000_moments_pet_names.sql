-- Persistent pet attribution for moments (run in Supabase SQL editor).
-- Adds denormalized pet_ids[] + pet_names text so feed cards show "— Tyson" and pet
-- profiles (which filter via .contains('pet_ids', [petId])) surface legacy moments,
-- independent of the moment_pets join and the pets RLS.

alter table public.moments add column if not exists pet_ids uuid[];
alter table public.moments add column if not exists pet_names text;

-- Backfill existing rows.

-- 1) Backfill pet_ids from the moment_pets join so legacy moments appear in pet profiles.
update public.moments m
set pet_ids = sub.ids
from (
  select mp.moment_id, array_agg(distinct mp.pet_id) as ids
  from public.moment_pets mp
  group by mp.moment_id
) sub
where m.id = sub.moment_id
  and (m.pet_ids is null or m.pet_ids = '{}');

-- 2) Backfill pet_names from the moment_pets -> pets join (most accurate).
update public.moments m
set pet_names = sub.names
from (
  select mp.moment_id, string_agg(p.name, ', ' order by p.name) as names
  from public.moment_pets mp
  join public.pets p on p.id = mp.pet_id
  group by mp.moment_id
) sub
where m.id = sub.moment_id
  and (m.pet_names is null or btrim(m.pet_names) = '');

-- 3) Backfill any remaining pet_names from the denormalized pet_ids array.
update public.moments m
set pet_names = sub.names
from (
  select mm.id as moment_id, string_agg(p.name, ', ') as names
  from public.moments mm
  join public.pets p on p.id = any (mm.pet_ids)
  where mm.pet_ids is not null
  group by mm.id
) sub
where m.id = sub.moment_id
  and (m.pet_names is null or btrim(m.pet_names) = '');
