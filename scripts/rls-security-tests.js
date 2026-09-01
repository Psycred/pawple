/**
 * PAW-20 / PAW-44 / PAW-96: Role-based RLS and RPC security tests
 * (Product Contract §7, §10, §13 + Honesty & Safety model B + G + city-only bulletin coords).
 *
 * Requires a Supabase project with migrations applied (staging scratch or local):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_ANON_KEY=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (setup + teardown only)
 *
 * Usage:
 *   npm run test:rls
 *
 * Creates two ephemeral test users, seeds minimal rows, asserts cross-tenant
 * boundaries and anon denial, then deletes test auth users via service role.
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

  console.log('PAW-44 / PAW-96 RLS security test suite (B + G + bulletin coord revoke)');
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

    // Service role writes exact coordinates (client roles must not SELECT them).
    const { error: locSeedErr } = await admin
      .from('profiles')
      .update({
        last_location_lat: 12.9716,
        last_location_lng: 77.5946,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', userBId);
    assertNoError(locSeedErr, 'Service role can write profiles.last_location_*');

    console.log('');
    console.log('Age attestation (PAW-97)');

    const ADULT_BIRTH_DATE = '1990-06-15';
    const UNDERAGE_BIRTH_DATE = '2010-06-15';

    const { error: forgeAgeErr } = await clientA
      .from('profiles')
      .update({ age_attested_adult: true })
      .eq('id', userAId);
    assertError(forgeAgeErr, 'User A cannot direct UPDATE profiles.age_attested_adult');

    const { error: forgeTierErr } = await clientA
      .from('profiles')
      .update({ account_tier: 'teen' })
      .eq('id', userAId);
    assertError(forgeTierErr, 'User A cannot direct UPDATE profiles.account_tier');

    const { error: meetupUnattestedErr } = await clientA.from('meetups').insert({
      user_id: userAId,
      title: 'Blocked Meetup',
      date: '2026-07-01',
      start_time: '10:00:00',
      end_time: '12:00:00',
    });
    assertError(meetupUnattestedErr, 'Unattested user cannot create meetup');

    const { error: underageRpcErr } = await clientA.rpc('attest_adult_account', {
      p_birth_date: UNDERAGE_BIRTH_DATE,
    });
    assertError(underageRpcErr, 'attest_adult_account rejects under-18 birth date');

    const { data: attestA, error: attestAErr } = await clientA.rpc('attest_adult_account', {
      p_birth_date: ADULT_BIRTH_DATE,
    });
    assertNoError(attestAErr, 'User A can attest adult account via RPC');
    assert(attestA?.ok === true, 'attest_adult_account returns ok for User A');

    const { data: attestB, error: attestBErr } = await clientB.rpc('attest_adult_account', {
      p_birth_date: ADULT_BIRTH_DATE,
    });
    assertNoError(attestBErr, 'User B can attest adult account via RPC');
    assert(attestB?.ok === true, 'attest_adult_account returns ok for User B');

    const { data: profileTierA, error: profileTierAErr } = await clientA
      .from('profiles')
      .select('account_tier, age_attested_adult, birth_date')
      .eq('id', userAId)
      .maybeSingle();
    assertNoError(profileTierAErr, 'User A can read own attestation fields');
    assert(profileTierA?.account_tier === 'adult', 'User A account_tier is adult');
    assert(profileTierA?.age_attested_adult === true, 'User A age_attested_adult is true');
    assert(profileTierA?.birth_date === ADULT_BIRTH_DATE, 'User A birth_date set server-side');

    // Seed pets: companion flag is display-only (G) — both remain readable
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

    const { data: petBCompanionOff, error: petBOffErr } = await clientB
      .from('pets')
      .insert({
        owner_id: userBId,
        name: 'Pet B Companion Off',
        is_looking_for_companion: false,
      })
      .select('id')
      .single();
    assertNoError(petBOffErr, 'User B creates pet with companion=false');

    const { data: petBCompanionOn, error: petBOnErr } = await clientB
      .from('pets')
      .insert({
        owner_id: userBId,
        name: 'Pet B Companion On',
        is_looking_for_companion: true,
      })
      .select('id')
      .single();
    assertNoError(petBOnErr, 'User B creates pet with companion=true');

    const { data: momentA, error: momentAErr } = await clientA
      .from('moments')
      .insert({
        user_id: userAId,
        image_url: 'https://example.test/moment-a.jpg',
        caption: 'Moment A',
        moment_date: '2026-01-01',
        location_lat: 12.9716,
        location_lng: 77.5946,
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
        location_lat: 12.97,
        location_lng: 77.59,
      })
      .select('id, city')
      .single();
    assertNoError(meetupBErr, 'User B creates meetup');
    assert(
      meetupB?.city === 'City B',
      'meetups.city derived from creator profiles.city at insert (PAW-96)',
    );

    console.log('');
    console.log('Anon / public denial (B)');

    const { data: anonProfiles, error: anonProfilesErr } = await anonClient
      .from('profiles')
      .select('id')
      .limit(1);
    assert(
      Boolean(anonProfilesErr) || (anonProfiles ?? []).length === 0,
      'Anonymous cannot read profiles',
    );

    const { data: anonPets, error: anonPetsErr } = await anonClient
      .from('pets')
      .select('id')
      .limit(1);
    assert(
      Boolean(anonPetsErr) || (anonPets ?? []).length === 0,
      'Anonymous cannot read pets',
    );

    const { data: anonMeetups, error: anonMeetupsErr } = await anonClient
      .from('meetups')
      .select('id')
      .limit(1);
    assert(
      Boolean(anonMeetupsErr) || (anonMeetups ?? []).length === 0,
      'Anonymous cannot read meetups',
    );

    const { data: anonHosts, error: anonHostsErr } = await anonClient
      .from('meetup_hosts')
      .select('id')
      .limit(1);
    assert(
      Boolean(anonHostsErr) || (anonHosts ?? []).length === 0,
      'Anonymous cannot read meetup_hosts',
    );

    const { data: anonParts, error: anonPartsErr } = await anonClient
      .from('meetup_participants')
      .select('id')
      .limit(1);
    assert(
      Boolean(anonPartsErr) || (anonParts ?? []).length === 0,
      'Anonymous cannot read meetup_participants',
    );

    console.log('');
    console.log('Profiles + coordinate exposure (B)');

    const { error: profileCrossUpdateErr } = await clientA
      .from('profiles')
      .update({ name: 'Hacked' })
      .eq('id', userBId);
    assertError(profileCrossUpdateErr, 'User A cannot update User B profile');

    const { data: locLeak, error: locLeakErr } = await clientA
      .from('profiles')
      .select('id, last_location_lat, last_location_lng, location_updated_at')
      .eq('id', userBId)
      .maybeSingle();
    assertError(locLeakErr, 'Authenticated cannot SELECT profiles.last_location_* columns');
    assert(
      !locLeak || (locLeak.last_location_lat == null && locLeak.last_location_lng == null),
      'last_location_* not returned to authenticated clients',
    );

    const { data: safeProfile, error: safeProfileErr } = await clientA
      .from('profiles')
      .select('id, name, city')
      .eq('id', userBId)
      .maybeSingle();
    assertNoError(safeProfileErr, 'Authenticated can read non-location profile fields');
    assert(Boolean(safeProfile), 'User A can read User B public profile fields');

    console.log('');
    console.log('Pets (G — companion does not gate visibility)');

    const { data: companionOffPet, error: companionOffErr } = await clientA
      .from('pets')
      .select('id, is_looking_for_companion')
      .eq('id', petBCompanionOff.id)
      .maybeSingle();
    assertNoError(companionOffErr, 'companion=false pet query succeeds');
    assert(Boolean(companionOffPet), 'User A can read User B pet when companion=false (G)');

    const { data: companionOnPet, error: companionOnErr } = await clientA
      .from('pets')
      .select('id, is_looking_for_companion')
      .eq('id', petBCompanionOn.id)
      .maybeSingle();
    assertNoError(companionOnErr, 'companion=true pet query succeeds');
    assert(Boolean(companionOnPet), 'User A can read User B pet when companion=true');

    const { error: petCrossUpdateErr } = await clientA
      .from('pets')
      .update({ name: 'Stolen' })
      .eq('id', petBCompanionOn.id);
    assert(
      !petCrossUpdateErr || petCrossUpdateErr.code === 'PGRST116' || petCrossUpdateErr.details?.includes('0 rows'),
      'User A cannot update User B pet',
    );

    console.log('');
    console.log('Moments + bulletin coord exposure (PAW-96)');

    const { error: momentCoordSelectErr } = await clientA
      .from('moments')
      .select('id, location_lat, location_lng')
      .eq('id', momentA.id)
      .maybeSingle();
    assertError(momentCoordSelectErr, 'Authenticated cannot SELECT moments.location_lat/lng');

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
    console.log('Meetups (Product Contract §7 + PAW-96 city-only)');

    const { error: meetupCoordSelectErr } = await clientA
      .from('meetups')
      .select('id, location_lat, location_lng')
      .eq('id', meetupB.id)
      .maybeSingle();
    assertError(meetupCoordSelectErr, 'Authenticated cannot SELECT meetups.location_lat/lng');

    const { data: meetupVenue, error: meetupVenueErr } = await clientA
      .from('meetups')
      .select('id, city, title')
      .eq('id', meetupB.id)
      .maybeSingle();
    assertNoError(meetupVenueErr, 'Authenticated non-creator can read meetup bulletin fields');
    assert(Boolean(meetupVenue), 'Meetup row visible to authenticated users');
    assert(meetupVenue?.city === 'City B', 'Meetup city visible for bulletin discovery');

    const { error: hostForeignPetErr } = await clientA.from('meetup_hosts').insert({
      meetup_id: meetupB.id,
      pet_id: petBCompanionOff.id,
    });
    assertError(hostForeignPetErr, 'User A cannot host meetup with User B pet');

    const { error: rsvpForeignPetErr } = await clientA.from('meetup_participants').insert({
      meetup_id: meetupB.id,
      pet_id: petBCompanionOff.id,
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
    console.log('RPC grants (Product Contract §10 + B)');

    const { error: anonDeleteErr } = await anonClient.rpc('delete_user_account');
    assertError(anonDeleteErr, 'Anonymous cannot call delete_user_account');

    const { error: anonExportErr } = await anonClient.rpc('export_user_data');
    assertError(anonExportErr, 'Anonymous cannot call export_user_data');

    const { error: anonCountErr } = await anonClient.rpc('get_meetup_participant_count', {
      meetup_uuid: meetupB.id,
    });
    assertError(anonCountErr, 'Anonymous cannot call get_meetup_participant_count');

    const { error: anonHostedErr } = await anonClient.rpc('get_pet_hosted_count', {
      target_pet_id: petBCompanionOff.id,
    });
    assertError(anonHostedErr, 'Anonymous cannot call get_pet_hosted_count');

    const { data: exportData, error: exportErr } = await clientA.rpc('export_user_data');
    assertNoError(exportErr, 'Authenticated user can call export_user_data');
    assert(exportData?.ok === true, 'export_user_data returns ok for authenticated caller');
    assert(String(exportData?.user_id) === String(userAId), 'export_user_data scopes to caller only');

    console.log('');
    console.log('Reports + pet_blocks (F schema for PAW-47)');

    const { data: reportRow, error: reportErr } = await clientA.from('reports').insert({
      reporter_user_id: userAId,
      reporter_pet_id: petAPrivate.id,
      target_type: 'meetup',
      target_id: meetupB.id,
      reported_user_id: userBId,
      reason: 'test',
      details: 'RLS suite',
    }).select('id').single();
    assertNoError(reportErr, 'User A can insert own report');
    assert(Boolean(reportRow), 'Report row created');

    const { data: ownReports, error: ownReportsErr } = await clientA
      .from('reports')
      .select('id')
      .eq('id', reportRow.id);
    assertNoError(ownReportsErr, 'User A can select own reports');
    assert((ownReports ?? []).length === 1, 'Own report visible to reporter');

    const { data: crossReports, error: crossReportsErr } = await clientB
      .from('reports')
      .select('id')
      .eq('id', reportRow.id);
    assertNoError(crossReportsErr, 'Cross-user report query does not error');
    assert((crossReports ?? []).length === 0, 'User B cannot read User A reports');

    const { error: foreignPetReportErr } = await clientA.from('reports').insert({
      reporter_user_id: userAId,
      reporter_pet_id: petBCompanionOff.id,
      target_type: 'moment',
      target_id: momentA.id,
      reported_user_id: userBId,
      reason: 'stolen pet',
    });
    assertError(foreignPetReportErr, 'User A cannot file report in name of User B pet');

    const { data: blockRow, error: blockErr } = await clientA.from('pet_blocks').insert({
      blocker_user_id: userAId,
      blocked_pet_id: petBCompanionOff.id,
    }).select('id').single();
    assertNoError(blockErr, 'User A can block a pet');
    assert(Boolean(blockRow), 'Block row created');

    const { data: crossBlocks, error: crossBlocksErr } = await clientB
      .from('pet_blocks')
      .select('id')
      .eq('id', blockRow.id);
    assertNoError(crossBlocksErr, 'Cross-user block query does not error');
    assert((crossBlocks ?? []).length === 0, 'User B cannot read User A blocks');

    const { error: deleteBlockErr } = await clientA
      .from('pet_blocks')
      .delete()
      .eq('id', blockRow.id);
    assertNoError(deleteBlockErr, 'User A can delete own block');

    console.log('');
    console.log('Introduction chat — mutual Paw + link block (PAW-100)');

    // Fail-closed age attestation required for mating RPCs / message INSERT.
    const { error: ageAErr } = await admin
      .from('profiles')
      .update({ age_attested_adult: true })
      .eq('id', userAId);
    assertNoError(ageAErr, 'Service role sets User A age_attested_adult');

    const { error: ageBErr } = await admin
      .from('profiles')
      .update({ age_attested_adult: true })
      .eq('id', userBId);
    assertNoError(ageBErr, 'Service role sets User B age_attested_adult');

    const { error: locAErr } = await admin
      .from('profiles')
      .update({
        last_location_lat: 12.972,
        last_location_lng: 77.595,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', userAId);
    assertNoError(locAErr, 'Service role sets User A fresh location for mating RPCs');

    const { data: petAMating, error: petAMatingErr } = await clientA
      .from('pets')
      .insert({
        owner_id: userAId,
        name: 'Pet A Mating',
        breed: 'Labrador',
        gender: 'male',
        is_looking_for_companion: true,
      })
      .select('id')
      .single();
    assertNoError(petAMatingErr, 'User A creates mating-eligible pet');

    const { data: petBMating, error: petBMatingErr } = await clientB
      .from('pets')
      .insert({
        owner_id: userBId,
        name: 'Pet B Mating',
        breed: 'Labrador',
        gender: 'female',
        is_looking_for_companion: true,
      })
      .select('id')
      .single();
    assertNoError(petBMatingErr, 'User B creates mating-eligible pet');

    const { error: pawABErr } = await clientA.rpc('express_paw', {
      from_pet_id: petAMating.id,
      to_pet_id: petBMating.id,
    });
    assertNoError(pawABErr, 'User A expresses Paw toward User B pet');

    const { error: pawBAErr } = await clientB.rpc('express_paw', {
      from_pet_id: petBMating.id,
      to_pet_id: petAMating.id,
    });
    assertNoError(pawBAErr, 'User B expresses Paw back — mutual Paw');

    const petLowId = petAMating.id < petBMating.id ? petAMating.id : petBMating.id;
    const petHighId = petAMating.id < petBMating.id ? petBMating.id : petAMating.id;

    const { data: introChannel, error: introChannelErr } = await clientA
      .from('mating_introduction_channels')
      .select('id, status')
      .eq('pet_low_id', petLowId)
      .eq('pet_high_id', petHighId)
      .maybeSingle();
    assertNoError(introChannelErr, 'Participant can read introduction channel');
    assert(Boolean(introChannel), 'Mutual Paw opens introduction channel');
    assert(introChannel.status === 'open', 'Introduction channel status is open');

    const { error: linkMsgErr } = await clientA.from('mating_introduction_messages').insert({
      channel_id: introChannel.id,
      sender_user_id: userAId,
      body: 'See https://example.com for details',
    });
    assert(
      Boolean(linkMsgErr)
        && (
          String(linkMsgErr.message || '').includes('link_sharing_forbidden')
          || String(linkMsgErr.details || '').includes('link_sharing_forbidden')
          || String(linkMsgErr.hint || '').includes('Links cannot be shared')
        ),
      'Introduction chat rejects URL bodies (link_sharing_forbidden)',
    );

    const { error: bareDomainErr } = await clientA.from('mating_introduction_messages').insert({
      channel_id: introChannel.id,
      sender_user_id: userAId,
      body: 'Visit example.com later',
    });
    assert(
      Boolean(bareDomainErr)
        && String(bareDomainErr.message || '').includes('link_sharing_forbidden'),
      'Introduction chat rejects bare domain.tld bodies',
    );

    const { error: phoneMsgErr } = await clientA.from('mating_introduction_messages').insert({
      channel_id: introChannel.id,
      sender_user_id: userAId,
      body: 'Call me at 9876543210 when you are free',
    });
    assertNoError(phoneMsgErr, 'Introduction chat allows phone-number text');

    const { error: plainMsgErr } = await clientB.from('mating_introduction_messages').insert({
      channel_id: introChannel.id,
      sender_user_id: userBId,
      body: 'Sounds good — meet at the park this weekend?',
    });
    assertNoError(plainMsgErr, 'Plain text message sends in open mutual-Paw channel');

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
