-- PAW-22 / A6: Server-controlled data export (Product Contract §10 Export).
-- Authenticated users receive a JSON archive of their own canonical data only.
-- Read-only; does not mutate state. Frontend shares the payload on-device (no email).

CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, extensions
AS $$
DECLARE
  target_user_id uuid := auth.uid();
  profile_json jsonb;
  pets_json jsonb;
  moments_json jsonb;
  likes_json jsonb;
  invites_json jsonb;
  meetups_created_json jsonb;
  meetup_hosts_json jsonb;
  meetup_participations_json jsonb;
  mating_interest_json jsonb := '[]'::jsonb;
  storage_media_json jsonb;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000',
            HINT = 'Sign in before exporting your data.';
  END IF;

  SELECT to_jsonb(p)
  INTO profile_json
  FROM public.profiles p
  WHERE p.id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pet) ORDER BY pet.created_at NULLS LAST, pet.id), '[]'::jsonb)
  INTO pets_json
  FROM public.pets pet
  WHERE pet.owner_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.created_at NULLS LAST, m.id), '[]'::jsonb)
  INTO moments_json
  FROM public.moments m
  WHERE m.user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
  INTO likes_json
  FROM public.likes l
  WHERE l.user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  INTO invites_json
  FROM public.invites i
  WHERE i.user_id = target_user_id
     OR i.used_by_user_id = target_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(mu) ORDER BY mu.created_at NULLS LAST, mu.id), '[]'::jsonb)
  INTO meetups_created_json
  FROM public.meetups mu
  WHERE mu.user_id = target_user_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(mh) ORDER BY mh.created_at NULLS LAST, mh.id),
    '[]'::jsonb
  )
  INTO meetup_hosts_json
  FROM public.meetup_hosts mh
  INNER JOIN public.pets pet ON pet.id = mh.pet_id
  WHERE pet.owner_id = target_user_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(mp) ORDER BY mp.joined_at NULLS LAST, mp.id),
    '[]'::jsonb
  )
  INTO meetup_participations_json
  FROM public.meetup_participants mp
  INNER JOIN public.pets pet ON pet.id = mp.pet_id
  WHERE pet.owner_id = target_user_id;

  -- Mating / Paw interest (extend when E3 schema lands).
  IF to_regclass('public.paw_interests') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COALESCE(jsonb_agg(to_jsonb(pi)), '[]'::jsonb)
      FROM public.paw_interests pi
      WHERE pi.from_user_id = $1
         OR pi.to_user_id = $1
         OR pi.from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR pi.to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
    $sql$
    INTO mating_interest_json
    USING target_user_id;
  ELSIF to_regclass('public.pet_paw_interests') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COALESCE(jsonb_agg(to_jsonb(ppi)), '[]'::jsonb)
      FROM public.pet_paw_interests ppi
      WHERE ppi.user_id = $1
         OR ppi.from_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
         OR ppi.to_pet_id IN (SELECT id FROM public.pets WHERE owner_id = $1)
    $sql$
    INTO mating_interest_json
    USING target_user_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'bucket_id', o.bucket_id,
        'path', o.name,
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      ORDER BY o.created_at NULLS LAST, o.name
    ),
    '[]'::jsonb
  )
  INTO storage_media_json
  FROM storage.objects o
  WHERE o.bucket_id IN ('moments', 'pet-photos')
    AND (storage.foldername(o.name))[1] = target_user_id::text;

  RETURN jsonb_build_object(
    'ok', true,
    'exported_at', NOW(),
    'user_id', target_user_id,
    'format', 'pawple-data-export-v1',
    'schema_version', 1,
    'profile', COALESCE(profile_json, 'null'::jsonb),
    'pets', pets_json,
    'moments', moments_json,
    'likes', likes_json,
    'invites', invites_json,
    'meetups_created', meetups_created_json,
    'meetup_hosts', meetup_hosts_json,
    'meetup_participations', meetup_participations_json,
    'mating_interest', mating_interest_json,
    'storage_media', storage_media_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

COMMENT ON FUNCTION public.export_user_data() IS
  'Product Contract §10 Export: returns a JSON archive of the caller''s profile, pets, moments, likes, invites, meetups, participation rows, mating interest (when present), and owner-scoped storage references. Frontend: supabase.rpc(''export_user_data'').';
