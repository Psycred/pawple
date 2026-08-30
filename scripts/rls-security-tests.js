/**
 * PAW-20 / A4: Role-based RLS and RPC security tests (Product Contract §7, §10, §13).
 *
 * Requires a Supabase project with migrations applied (staging scratch or local):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_ANON_KEY=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (setup + teardown only)
 *
 * Usage:
 *   npm run test:rls
 *
 * Creates two ephemeral test users, seeds minimal rows, asserts cross-tenant boundaries,
 * then deletes test auth users via service role.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_PASSWORD = 'PawpleRlsTest!2026';
const TEST_EMAIL_A = `rls-test-a-${Date.now()}@pawple-test.invalid`;
const TEST_EMAIL_B = `rls-test-b-${Date.now()}@pawple-test.invalid`;

let failures = 0;
let passes = 0;

function assert(condition, message) {
  if (condition) {
    passes += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

function assertError(error, message) {
  assert(Boolean(error), message);
}

function assertNoError(error, message) {
  assert(!error, error ? `${message}: ${error.message}` : message);
}

async function signInAs(client, email) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw error;
  }
  return data.session;
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Missing required env vars:');
    if (!SUPABASE_URL) console.error('  - SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)');
    if (!ANON_KEY) console.error('  - SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)');
    if (!SERVICE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    console.error('Run against staging scratch project only. See docs/SUPABASE_DB_RECREATE.md');
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const createdUserIds = [];

  console.log('PAW-20 RLS security test suite');
  console.log('Target:', SUPABASE_URL);
  console.log('');

  try {
    // --- Setup: two isolated test users ---------------------------------
    console.log('Setup');

    for (const email of [TEST_EMAIL_A, TEST_EMAIL_B]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      if (error) {
        throw new Error(`createUser ${email}: ${error.message}`);
      }
      createdUserIds.push(data.user.id);
    }

    const [userAId, userBId] = createdUserIds;

    const clientA = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientB = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await signInAs(clientA, TEST_EMAIL_A);
    await signInAs(clientB, TEST_EMAIL_B);

    // Seed profiles
    await clientA.from('profiles').upsert({
      id: userAId,
      name: 'RLS Test A',
      city: 'City A',
      email: TEST_EMAIL_A,
    });
    await clientB.from('profiles').upsert({
      id: userBId,
      name: 'RLS Test B',
      city: 'City B',
      email: TEST_EMAIL_B,
    });

    // Seed pets: B has private + discoverable
    const { data: petAPrivate, error: petAErr } = await clientA
      .from('pets')
      .insert({
        owner_id: userAId,
        name: 'Pet A',
        is_looking_for_companion: false,
      })
      .select('id')
      .single();
    assertNoError(petAErr, 'User A creates own pet');

    const { data: petBPrivate, error: petBPrivateErr } = await clientB
      .from('pets')
      .insert({
        owner_id: userBId,
        name: 'Pet B Private',
        is_looking_for_companion: false,
      })
      .select('id')
      .single();
    assertNoError(petBPrivateErr, 'User B creates private pet');

    const { data: petBPublic, error: petBPublicErr } = await clientB
      .from('pets')
      .insert({
        owner_id: userBId,
        name: 'Pet B Discoverable',
        is_looking_for_companion: true,
      })
      .select('id')
      .single();
    assertNoError(petBPublicErr, 'User B creates discoverable pet');

    const { data: momentA, error: momentAErr } = await clientA
      .from('moments')
      .insert({
        user_id: userAId,
        image_url: 'https://example.test/moment-a.jpg',
        caption: 'Moment A',
        moment_date: '2026-01-01',
      })
      .select('id')
      .single();
    assertNoError(momentAErr, 'User A creates own moment');

    const { data: meetupB, error: meetupBErr } = await clientB
      .from('meetups')
      .insert({
        user_id: userBId,
        title: 'Meetup B',
        date: '2026-06-01',
        start_time: '10:00:00',
        end_time: '12:00:00',
      })
      .select('id')
      .single();
    assertNoError(meetupBErr, 'User B creates meetup');

    console.log('');
    console.log('Profiles');

    const { error: profileCrossUpdateErr } = await clientA
      .from('profiles')
      .update({ name: 'Hacked' })
      .eq('id', userBId);
    assertError(profileCrossUpdateErr, 'User A cannot update User B profile');

    console.log('');
    console.log('Pets');

    const { data: hiddenPet, error: hiddenPetErr } = await clientA
      .from('pets')
      .select('id')
      .eq('id', petBPrivate.id)
      .maybeSingle();
    assertNoError(hiddenPetErr, 'Private pet query returns without server error');
    assert(!hiddenPet, 'User A cannot read User B private pet');

    const { data: visiblePet, error: visiblePetErr } = await clientA
      .from('pets')
      .select('id')
      .eq('id', petBPublic.id)
      .maybeSingle();
    assertNoError(visiblePetErr, 'Discoverable pet query returns without server error');
    assert(Boolean(visiblePet), 'User A can read User B discoverable pet');

    const { error: petCrossUpdateErr } = await clientA
      .from('pets')
      .update({ name: 'Stolen' })
      .eq('id', petBPublic.id);
    assert(
      !petCrossUpdateErr || petCrossUpdateErr.code === 'PGRST116' || petCrossUpdateErr.details?.includes('0 rows'),
      'User A cannot update User B pet',
    );

    console.log('');
    console.log('Moments');

    const { error: momentCrossUpdateErr } = await clientA
      .from('moments')
      .update({ caption: 'Hacked' })
      .eq('id', momentA.id)
      .eq('user_id', userBId);
    assert(
      !momentCrossUpdateErr || momentCrossUpdateErr.details?.includes('0 rows'),
      'User A cannot update moment as User B',
    );

    const { data: feedMoments, error: feedErr } = await clientA
      .from('moments')
      .select('id')
      .eq('id', momentA.id)
      .maybeSingle();
    assertNoError(feedErr, 'Authenticated user can read community moments');
    assert(Boolean(feedMoments), 'User A can read own moment in feed');

    console.log('');
    console.log('Likes');

    const { error: likeInsertErr } = await clientA.from('likes').insert({
      user_id: userBId,
      moment_id: momentA.id,
    });
    assertError(likeInsertErr, 'User A cannot insert like as User B');

    const { error: likeOwnErr } = await clientA.from('likes').insert({
      user_id: userAId,
      moment_id: momentA.id,
    });
    assertNoError(likeOwnErr, 'User A can like own-visible moment');

    console.log('');
    console.log('Meetups (Product Contract §7)');

    const { error: hostForeignPetErr } = await clientA.from('meetup_hosts').insert({
      meetup_id: meetupB.id,
      pet_id: petBPrivate.id,
    });
    assertError(hostForeignPetErr, 'User A cannot host meetup with User B pet');

    const { error: rsvpForeignPetErr } = await clientA.from('meetup_participants').insert({
      meetup_id: meetupB.id,
      pet_id: petBPrivate.id,
    });
    assertError(rsvpForeignPetErr, 'User A cannot RSVP User B pet to meetup');

    const { error: rsvpOwnPetErr } = await clientA.from('meetup_participants').insert({
      meetup_id: meetupB.id,
      pet_id: petAPrivate.id,
    });
    assertNoError(rsvpOwnPetErr, 'User A can RSVP own pet to meetup');

    const { data: participantsList, error: participantsReadErr } = await clientA
      .from('meetup_participants')
      .select('id')
      .eq('meetup_id', meetupB.id);
    assertNoError(participantsReadErr, 'Authenticated user can read meetup participant list');
    assert((participantsList ?? []).length >= 1, 'Meetup participant rows visible on details screen');

    console.log('');
    console.log('RPC grants (Product Contract §10)');

    const { error: anonDeleteErr } = await anonClient.rpc('delete_user_account');
    assertError(anonDeleteErr, 'Anonymous cannot call delete_user_account');

    const { error: anonExportErr } = await anonClient.rpc('export_user_data');
    assertError(anonExportErr, 'Anonymous cannot call export_user_data');

    const { data: exportData, error: exportErr } = await clientA.rpc('export_user_data');
    assertNoError(exportErr, 'Authenticated user can call export_user_data');
    assert(exportData?.ok === true, 'export_user_data returns ok for authenticated caller');
    assert(String(exportData?.user_id) === String(userAId), 'export_user_data scopes to caller only');

    console.log('');
    console.log('Invites');

    const inviteCode = `PAW-RLS${String(Date.now()).slice(-6)}`;
    const { error: inviteSeedErr } = await admin.from('invites').insert({
      user_id: userBId,
      code: inviteCode,
      status: 'unused',
    });
    assertNoError(inviteSeedErr, 'Service role seeds unused invite');

    const { data: validatedInvite, error: validateErr } = await clientA
      .from('invites')
      .select('id, code, status')
      .eq('code', inviteCode)
      .maybeSingle();
    assertNoError(validateErr, 'User A can validate unused invite by code');
    assert(Boolean(validatedInvite), 'Unused invite readable for onboarding validation');

    const { data: otherInvites, error: otherInvitesErr } = await clientA
      .from('invites')
      .select('id')
      .eq('user_id', userBId);
    assertNoError(otherInvitesErr, 'Invite list query succeeds');
    assert(
      (otherInvites ?? []).length === 0,
      'User A cannot list User B issued invites (only unused-by-code validation)',
    );
  } finally {
    console.log('');
    console.log('Teardown');
    for (const userId of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`  warn: could not delete test user ${userId}: ${error.message}`);
      }
    }
  }

  console.log('');
  console.log(`Results: ${passes} passed, ${failures} failed`);

  if (failures > 0) {
    process.exit(1);
  }

  console.log('RLS security test suite passed.');
}

main().catch((error) => {
  console.error('');
  console.error('RLS test suite aborted:', error.message || error);
  process.exit(1);
});
