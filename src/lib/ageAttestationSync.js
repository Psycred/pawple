import { hasPassedAgeGate } from './ageGate';
import { supabase } from '../config/supabase';

/**
 * Mirror device-local age gate success to profiles.age_attested_adult when signed in.
 * Update-only — never creates a bare profile row (would break onboarding routing).
 * Idempotent and best-effort; server remains fail-closed until this succeeds.
 *
 * @returns {Promise<boolean>} true when the server column is attested after this call
 */
export async function syncAgeAttestationToProfile(userId) {
  if (!userId) {
    return false;
  }

  try {
    const passed = await hasPassedAgeGate();
    if (!passed) {
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || user.id !== userId) {
      return false;
    }

    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('age_attested_adult')
      .eq('id', userId)
      .maybeSingle();

    if (readError) {
      console.error('[Supabase]', readError);
      return false;
    }

    if (!existing) {
      return false;
    }

    if (existing.age_attested_adult === true) {
      return true;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        age_attested_adult: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[Supabase]', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[AgeGate] syncAgeAttestationToProfile failed', error);
    return false;
  }
}

/**
 * Best-effort server sync after local age gate pass when a session already exists.
 */
export async function syncAgeAttestationAfterLocalPass() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return false;
    }
    return syncAgeAttestationToProfile(user.id);
  } catch (error) {
    console.error('[AgeGate] post-pass server sync failed', error);
    return false;
  }
}
