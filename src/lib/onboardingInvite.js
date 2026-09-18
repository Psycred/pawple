import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { isLocalDevRuntime, pawpleEnv } from '../config/environment';

const pendingInviteKey = (userId) => `onboarding_pending_invite:${userId}`;
const preAuthPendingInviteKey = 'onboarding_pending_invite:pre_auth';
export const DEVELOPMENT_BOOTSTRAP_INVITE_CODE = 'Paw-T00y';
export const BETA_BOOTSTRAP_INVITE_CODE = 'PAW-3600';
const NORMALIZED_BETA_BOOTSTRAP_INVITE_CODE = BETA_BOOTSTRAP_INVITE_CODE.toUpperCase();
export const BETA_BASELINE = 85; // profiles existing at beta ship (Founder = user 00, not counted)
export const BETA_USER_CAP = 100;
export function isBetaBootstrapInviteCode(code) {
  return (
    String(code ?? '').trim().replace(/^@/, '').toUpperCase() ===
    NORMALIZED_BETA_BOOTSTRAP_INVITE_CODE
  );
}
async function isBetaFull() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  if (error) return true; // fail closed
  return (count ?? 0) >= BETA_BASELINE + BETA_USER_CAP;
}
const NORMALIZED_DEVELOPMENT_BOOTSTRAP_INVITE_CODE =
  DEVELOPMENT_BOOTSTRAP_INVITE_CODE.toUpperCase();

export function isDevelopmentInviteRuntime() {
  return isLocalDevRuntime && pawpleEnv === 'development';
}

export function getDefaultDevelopmentInviteCode() {
  return isDevelopmentInviteRuntime() ? DEVELOPMENT_BOOTSTRAP_INVITE_CODE : '';
}

export function isDevelopmentBootstrapInviteCode(code) {
  return (
    String(code ?? '').trim().toUpperCase() ===
    NORMALIZED_DEVELOPMENT_BOOTSTRAP_INVITE_CODE
  );
}

/**
 * Validate an invite code without consuming it (Product Contract §4 step 2).
 * @returns {{ ok: true, inviteId: string } | { ok: false, reason: string }}
 */
export async function validateInviteCode(code, userId) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) {
    return { ok: false, reason: 'empty' };
  }

  if (isBetaBootstrapInviteCode(normalized)) {
    return { ok: true, inviteId: null, code: BETA_BOOTSTRAP_INVITE_CODE };
  }

  if (isDevelopmentBootstrapInviteCode(normalized)) {
    if (!isDevelopmentInviteRuntime()) {
      return { ok: false, reason: 'invalid' };
    }
    return {
      ok: true,
      inviteId: null,
      code: DEVELOPMENT_BOOTSTRAP_INVITE_CODE,
    };
  }

  const { data, error } = await supabase
    .from('invites')
    .select('id, user_id, status')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!data?.id || data.status === 'used') {
    return { ok: false, reason: 'invalid' };
  }

  if (userId && String(data.user_id) === String(userId)) {
    return { ok: false, reason: 'own_invite' };
  }

  return { ok: true, inviteId: data.id, code: normalized };
}

export async function storePendingInvite(userId, code) {
  if (!code) {
    return;
  }

  const normalizedCode = String(code).trim().toUpperCase();

  if (userId) {
    await AsyncStorage.setItem(pendingInviteKey(userId), normalizedCode);
    return;
  }

  await AsyncStorage.setItem(preAuthPendingInviteKey, normalizedCode);
}

export async function getPendingInvite(userId) {
  if (!userId) {
    return null;
  }

  const userKey = pendingInviteKey(userId);
  const stored = await AsyncStorage.getItem(userKey);

  if (stored) {
    return stored.trim().toUpperCase();
  }

  const preAuthInvite = await AsyncStorage.getItem(preAuthPendingInviteKey);

  if (!preAuthInvite) {
    return null;
  }

  const normalizedInvite = preAuthInvite.trim().toUpperCase();

  await AsyncStorage.setItem(userKey, normalizedInvite);
  await AsyncStorage.removeItem(preAuthPendingInviteKey);

  return normalizedInvite;
}

export async function clearPendingInvite(userId) {
  if (userId) {
    await AsyncStorage.removeItem(pendingInviteKey(userId));
  }

  await AsyncStorage.removeItem(preAuthPendingInviteKey);
}
export async function completeOnboarding({ userId, inviteId, inviteCode }) {
  const completedAt = new Date().toISOString();
  const isBetaBootstrap = isBetaBootstrapInviteCode(inviteCode);
  if (isBetaBootstrap && (await isBetaFull())) {
    throw new Error('The Pawple beta is currently full.');
  }

  const isDevelopmentBootstrap =
    isDevelopmentBootstrapInviteCode(inviteCode);

  if (isDevelopmentBootstrap) {
    if (!isDevelopmentInviteRuntime()) {
      throw new Error('Development invite codes are unavailable in this build.');
    }
  }

  if (inviteId && !isDevelopmentBootstrap) {
    const { data: redeemedInvite, error: redeemError } = await supabase
      .from('invites')
      .update({ status: 'used', used_by_user_id: userId, used_at: completedAt })
      .eq('id', inviteId)
      .eq('status', 'unused')
      .select('id')
      .maybeSingle();

    if (redeemError) {
      console.error('[Supabase]', redeemError);
      throw redeemError;
    }

    if (!redeemedInvite?.id) {
      const { data: alreadyUsed } = await supabase
        .from('invites')
        .select('id, used_by_user_id')
        .eq('id', inviteId)
        .eq('status', 'used')
        .maybeSingle();
      if (String(alreadyUsed?.used_by_user_id) !== String(userId)) {
        if (inviteCode) {
          const check = await validateInviteCode(inviteCode, userId);
          if (check.ok) {
            throw new Error('Invite could not be consumed. It may have been used elsewhere.');
          }
        }
        throw new Error('Invite code invalid or already used.');
      }
    }
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: completedAt, updated_at: completedAt })
    .eq('id', userId)
    .is('onboarding_completed_at', null)
    .select('id')
    .maybeSingle();

  if (profileError) {
    console.error('[Supabase]', profileError);
    throw profileError;
  }

  if (!updatedProfile?.id) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();
    if (!existing?.onboarding_completed_at) {
      throw new Error('Could not mark onboarding complete.');
    }
  }

  await clearPendingInvite(userId);
  return completedAt;
}
