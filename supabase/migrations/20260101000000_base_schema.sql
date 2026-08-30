-- PAW-20 / A3: Canonical base schema for empty-database migration replay.
-- Profiles, pets, moments, likes, invites, and transitional moment_pets predate
-- versioned migrations in production; this file makes the chain reproducible.
-- Idempotent where noted — safe on databases that already have these objects.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  city text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Pawple user profile keyed by Supabase Auth user id.';

-- ---------------------------------------------------------------------------
-- pets (owner-scoped; discoverability enforced in RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text,
  age text,
  gender text,
  vaccinated text,
  photo_url text,
  bio text,
  is_looking_for_companion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_owner_id_idx ON public.pets (owner_id);

COMMENT ON TABLE public.pets IS 'Pet identity — visible community object for journals, meetups, and discovery.';

-- ---------------------------------------------------------------------------
-- moments (canonical journal entity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  moment_date date,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moments_user_id_idx ON public.moments (user_id);
CREATE INDEX IF NOT EXISTS moments_created_at_idx ON public.moments (created_at DESC);

COMMENT ON TABLE public.moments IS 'Canonical pet-attributed memory rows for feed and journals.';

-- ---------------------------------------------------------------------------
-- likes (private per-user; no public counts in beta UI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES public.moments (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT likes_user_moment_unique UNIQUE (user_id, moment_id)
);

CREATE INDEX IF NOT EXISTS likes_moment_id_idx ON public.likes (moment_id);

-- ---------------------------------------------------------------------------
-- invites (issuer-owned; validation reads unused codes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  code text,
  status text NOT NULL DEFAULT 'unused',
  used_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invites_status_check CHECK (status IN ('unused', 'used'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invites_code_unique_idx ON public.invites (code);
CREATE INDEX IF NOT EXISTS invites_user_id_idx ON public.invites (user_id);

-- ---------------------------------------------------------------------------
-- moment_pets (transitional join — read/migration source only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moment_pets (
  moment_id uuid NOT NULL REFERENCES public.moments (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  PRIMARY KEY (moment_id, pet_id)
);

COMMENT ON TABLE public.moment_pets IS 'Transitional moment↔pet join. No new product functionality.';

-- ---------------------------------------------------------------------------
-- Row Level Security — core tables (Product Contract §5–§7, §11)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_pets ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- pets — owners full access; others only when opted into discovery
DROP POLICY IF EXISTS pets_select_visible ON public.pets;
CREATE POLICY pets_select_visible
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_looking_for_companion = true
  );

DROP POLICY IF EXISTS pets_insert_own ON public.pets;
CREATE POLICY pets_insert_own
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS pets_update_own ON public.pets;
CREATE POLICY pets_update_own
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS pets_delete_own ON public.pets;
CREATE POLICY pets_delete_own
  ON public.pets
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- moments — community feed read; owner write
DROP POLICY IF EXISTS moments_select_authenticated ON public.moments;
CREATE POLICY moments_select_authenticated
  ON public.moments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS moments_insert_own ON public.moments;
CREATE POLICY moments_insert_own
  ON public.moments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS moments_update_own ON public.moments;
CREATE POLICY moments_update_own
  ON public.moments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS moments_delete_own ON public.moments;
CREATE POLICY moments_delete_own
  ON public.moments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- likes — own rows only
DROP POLICY IF EXISTS likes_select_own ON public.likes;
CREATE POLICY likes_select_own
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS likes_insert_own ON public.likes;
CREATE POLICY likes_insert_own
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS likes_delete_own ON public.likes;
CREATE POLICY likes_delete_own
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- invites — list own; validate unused codes during onboarding
DROP POLICY IF EXISTS invites_select ON public.invites;
CREATE POLICY invites_select
  ON public.invites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR status = 'unused');

DROP POLICY IF EXISTS invites_insert_own ON public.invites;
CREATE POLICY invites_insert_own
  ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS invites_update_redeem ON public.invites;
CREATE POLICY invites_update_redeem
  ON public.invites
  FOR UPDATE
  TO authenticated
  USING (status = 'unused' OR user_id = auth.uid())
  WITH CHECK (true);

-- moment_pets — owner-scoped writes; authenticated read for migration compatibility
DROP POLICY IF EXISTS moment_pets_select ON public.moment_pets;
CREATE POLICY moment_pets_select
  ON public.moment_pets
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS moment_pets_insert_own ON public.moment_pets;
CREATE POLICY moment_pets_insert_own
  ON public.moment_pets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.moments m
      WHERE m.id = moment_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS moment_pets_delete_own ON public.moment_pets;
CREATE POLICY moment_pets_delete_own
  ON public.moment_pets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.moments m
      WHERE m.id = moment_id
        AND m.user_id = auth.uid()
    )
  );

-- API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
