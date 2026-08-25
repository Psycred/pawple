-- Run in Supabase SQL editor or via CLI. Adds pet species + optional free-text for "other".

alter table public.pets add column if not exists pet_type text;

alter table public.pets add column if not exists pet_type_custom text;

alter table public.pets drop constraint if exists pets_pet_type_check;

alter table public.pets
  add constraint pets_pet_type_check
  check (
    pet_type is null
    or pet_type in ('dog', 'cat', 'fish', 'other')
  );

comment on column public.pets.pet_type is 'Primary species: dog | cat | fish | other';
comment on column public.pets.pet_type_custom is 'Free text when pet_type = other (e.g. hamster, bird)';
