import { randomBytes } from 'node:crypto';
import { createAdminClient, createUserClient } from './clients.js';

const TEST_EMAIL_DOMAIN = 'pawple-integration.test';

export function uniqueEmail(prefix = 'user') {
  const token = randomBytes(6).toString('hex');
  return `${prefix}-${token}@${TEST_EMAIL_DOMAIN}`;
}

export function uniqueInviteCode() {
  const token = randomBytes(3).toString('hex').toUpperCase();
  return `PAW-INT${token}`;
}

const TEST_PASSWORD = 'PawpleIntegration!2026';

/**
 * Create auth user + profile via service role (Backend-coordinated setup path).
 * @returns {{ admin, userId, email, password, client }}
 */
export async function provisionTestUser({ emailPrefix = 'user', profile = {} } = {}) {
  const admin = createAdminClient();
  const email = uniqueEmail(emailPrefix);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { integration_test: true },
  });
  if (createError) {
    throw createError;
  }

  const userId = created.user.id;
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email,
    ...profile,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw profileError;
  }

  const client = createUserClient(emailPrefix);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw signInError;
  }

  return { admin, userId, email, password: TEST_PASSWORD, client };
}

export async function createUnusedInvite(admin, issuerUserId, code = uniqueInviteCode()) {
  const { data, error } = await admin
    .from('invites')
    .insert({ user_id: issuerUserId, code, status: 'unused' })
    .select('id, code')
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function createPet(client, ownerId, overrides = {}) {
  const { data, error } = await client
    .from('pets')
    .insert({
      owner_id: ownerId,
      name: overrides.name ?? 'IntegrationPet',
      breed: overrides.breed ?? 'Labrador',
      gender: overrides.gender ?? 'Male',
      pet_type: overrides.pet_type ?? 'dog',
      age: overrides.age ?? 3,
      ...overrides,
    })
    .select('id, name, owner_id')
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function forceDeleteUser(admin, userId) {
  if (!userId) {
    return;
  }
  const { data: ownedPets } = await admin.from('pets').select('id').eq('owner_id', userId);
  const petIds = (ownedPets ?? []).map((p) => p.id);
  if (petIds.length) {
    await admin.from('meetup_participants').delete().in('pet_id', petIds);
    await admin.from('meetup_hosts').delete().in('pet_id', petIds);
  }
  await admin.from('moments').delete().eq('user_id', userId);
  await admin.from('pets').delete().eq('owner_id', userId);
  await admin.from('meetups').delete().eq('user_id', userId);
  await admin.from('invites').delete().eq('user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

/** Mirrors src/lib/onboardingInvite.js validateInviteCode */
export async function validateInviteCode(client, code, userId) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) {
    return { ok: false, reason: 'empty' };
  }

  const { data, error } = await client
    .from('invites')
    .select('id, user_id, status')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
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

/** Mirrors src/lib/onboardingInvite.js completeOnboarding */
export async function completeOnboarding(client, { userId, inviteId }) {
  const completedAt = new Date().toISOString();

  if (inviteId) {
    const { data: redeemedInvite, error: redeemError } = await client
      .from('invites')
      .update({ status: 'used', used_by_user_id: userId, used_at: completedAt })
      .eq('id', inviteId)
      .eq('status', 'unused')
      .select('id')
      .maybeSingle();

    if (redeemError) {
      throw redeemError;
    }
    if (!redeemedInvite?.id) {
      throw new Error('Invite could not be consumed.');
    }
  }

  const { data: updatedProfile, error: profileError } = await client
    .from('profiles')
    .update({ onboarding_completed_at: completedAt, updated_at: completedAt })
    .eq('id', userId)
    .is('onboarding_completed_at', null)
    .select('id')
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }
  if (!updatedProfile?.id) {
    throw new Error('Could not mark onboarding complete.');
  }
  return completedAt;
}

/** Mirrors src/services/moments.js createMoment (core insert path). */
export async function createMoment(client, payload) {
  const basePayload = {
    user_id: payload.userId,
    image_url: payload.imageUrl ?? 'https://example.com/pawple-integration.jpg',
    caption: payload.caption?.trim() || 'Integration moment',
    moment_date: payload.momentDate ?? '2026-08-28',
    location: payload.location?.trim() || null,
    pet_ids: payload.petIds ?? [],
    pet_names: payload.petNames ?? null,
    location_lat: payload.location_lat ?? null,
    location_lng: payload.location_lng ?? null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from('moments').insert(basePayload).select().single();
  if (error) {
    throw error;
  }
  return data;
}

/** Mirrors src/services/meetups.js joinMeetupWithPets (real meetups only). */
export async function joinMeetupWithPets(client, meetupId, petIds) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  const ids = [...new Set(petIds.map(String))];
  const { data: ownedPets, error: petsError } = await client
    .from('pets')
    .select('id')
    .eq('owner_id', user.id)
    .in('id', ids);

  if (petsError) {
    throw petsError;
  }
  const ownedIds = new Set((ownedPets ?? []).map((row) => String(row.id)));
  if (ownedIds.size !== ids.length) {
    throw new Error('One or more pets do not belong to your account.');
  }

  const rows = ids.map((petId) => ({ meetup_id: meetupId, pet_id: petId }));
  const { error } = await client.from('meetup_participants').upsert(rows, {
    onConflict: 'meetup_id,pet_id',
    ignoreDuplicates: true,
  });
  if (error) {
    throw error;
  }
  return { joined: true, petIds: ids };
}

/** Mirrors src/lib/deleteAccount.js RPC invocation (without AsyncStorage). */
export async function deleteAccount(client) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  const { data, error } = await client.rpc('delete_user_account');
  if (error) {
    throw error;
  }
  if (!data?.ok) {
    throw new Error('Account deletion did not complete');
  }

  try {
    await client.auth.signOut();
  } catch {
    // Expected when auth row is already removed.
  }
  return data;
}
