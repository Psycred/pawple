-- Phase 1: meetups + memories (run in Supabase SQL editor)
-- Adjust if tables already exist.

create extension if not exists "pgcrypto";

create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  compatibility text not null default 'Open to all pets',
  directions_url text,
  date date not null,
  start_time time not null,
  end_time time not null,
  pet_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  photo_url text not null,
  caption text,
  pet_names text,
  location text,
  memory_date text,
  created_at timestamptz not null default now()
);

alter table public.meetups enable row level security;
alter table public.memories enable row level security;

create policy "meetups_select_all" on public.meetups for select using (true);
create policy "meetups_insert_own" on public.meetups for insert with check (auth.uid() = user_id);
create policy "meetups_update_own" on public.meetups for update using (auth.uid() = user_id);
create policy "meetups_delete_own" on public.meetups for delete using (auth.uid() = user_id);

create policy "memories_select_all" on public.memories for select using (true);
create policy "memories_insert_own" on public.memories for insert with check (auth.uid() = user_id);
create policy "memories_update_own" on public.memories for update using (auth.uid() = user_id);
create policy "memories_delete_own" on public.memories for delete using (auth.uid() = user_id);
