ALTER TABLE invites
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unused',
ADD COLUMN IF NOT EXISTS used_by_user_id UUID,
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invites_status_check'
      AND conrelid = 'invites'::regclass
  ) THEN
    ALTER TABLE invites
    ADD CONSTRAINT invites_status_check CHECK (status IN ('unused', 'used'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invites_code_unique_idx ON invites (code);
CREATE INDEX IF NOT EXISTS invites_user_id_idx ON invites (user_id);
CREATE INDEX IF NOT EXISTS invites_used_by_user_id_idx ON invites (used_by_user_id);

CREATE OR REPLACE FUNCTION ensure_user_invites(target_user_id UUID, target_count INTEGER DEFAULT 5)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code_suffix TEXT;
  next_code TEXT;
  remaining_count INTEGER;
  inserted_count INTEGER := 0;
  attempts INTEGER := 0;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF target_count IS NULL OR target_count < 0 THEN
    target_count := 5;
  END IF;

  SELECT GREATEST(target_count - COUNT(*), 0)
  INTO remaining_count
  FROM invites
  WHERE user_id = target_user_id;

  WHILE inserted_count < remaining_count AND attempts < 250 LOOP
    code_suffix := '';
    FOR i IN 1..6 LOOP
      code_suffix := code_suffix || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    next_code := 'PAW-' || code_suffix;
    attempts := attempts + 1;

    BEGIN
      INSERT INTO invites (user_id, code, status)
      VALUES (target_user_id, next_code, 'unused');
      inserted_count := inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        CONTINUE;
    END;
  END LOOP;

  IF inserted_count < remaining_count THEN
    RAISE EXCEPTION 'Could not generate enough unique invite codes for user %', target_user_id;
  END IF;
END;
$$;
