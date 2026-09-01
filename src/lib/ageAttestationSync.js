import { getStoredBirthDate, hasPassedAgeGate } from './ageGate';
import { supabase } from '../config/supabase';

/**
 * Mirror device-local age gate success to server attestation via RPC when signed in.
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

    const birthDate = await getStoredBirthDate();
    if (!birthDate) {
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
      .select('age_attested_adult, account_tier')
      .eq('id', userId)
      .maybeSingle();

    if (readError) {
      console.error('[Supabase]', readError);
      return false;
    }

    if (!existing) {
      return false;
    }

    if (existing.age_attested_adult === true && existing.account_tier === 'adult') {
      return true;
    }

    const { data: attestation, error: rpcError } = await supabase.rpc('attest_adult_account', {
      p_birth_date: birthDate,
    });

    if (rpcError) {
      console.error('[Supabase]', rpcError);
      return false;
    }

    return attestation?.ok === true && attestation?.age_attested_adult === true;
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
