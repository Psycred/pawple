/**
 * Public + private user profile data — meetup privacy enforced here.
 *
 * RULE: When viewer !== profile owner, only hosted meetups (creator) are returned.
 * Going lists and RSVP history are NEVER exposed on a public profile view.
 */

import { supabase } from '../config/supabase';
import {
  fetchGoingMeetups,
  fetchPublicHostedMeetups,
  filterShowablePublicMeetups,
} from './meetups';

function isSelfView(viewedUserId, viewerUserId) {
  return Boolean(
    viewedUserId && viewerUserId && String(viewedUserId) === String(viewerUserId),
  );
}

/**
 * Meetups for a user profile with strict privacy.
 *
 * - Public view (A views B): hosted meetups only (`user_id === viewedUserId`).
 * - Self view: hosted + going (going still fetched via self-only guard in meetups.js).
 *
 * @returns {Promise<{ isSelfView: boolean, hostedMeetups: object[], goingMeetups: object[] }>}
 */
export async function fetchMeetupsForUserProfile(viewedUserId, viewerUserId) {
  if (!viewedUserId) {
    return { isSelfView: false, hostedMeetups: [], goingMeetups: [] };
  }

  const self = isSelfView(viewedUserId, viewerUserId);

  // Public-safe query: creator/host only — never participant-only rows.
  const hostedRows = await fetchPublicHostedMeetups(viewedUserId);
  const hostedMeetups = filterShowablePublicMeetups(hostedRows);

  if (!self) {
    return {
      isSelfView: false,
      hostedMeetups,
      goingMeetups: [],
    };
  }

  const goingMeetups = await fetchGoingMeetups(viewedUserId, { viewerUserId });
  return {
    isSelfView: true,
    hostedMeetups,
    goingMeetups,
  };
}

/**
 * Load a user profile for display (public or self).
 * Meetup sections follow the same privacy rules as fetchMeetupsForUserProfile.
 */
export async function fetchPublicUserProfile(viewedUserId, viewerUserId) {
  if (!viewedUserId) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, city')
    .eq('id', viewedUserId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const { isSelfView: self, hostedMeetups, goingMeetups } =
    await fetchMeetupsForUserProfile(viewedUserId, viewerUserId);

  return {
    profile,
    isSelfView: self,
    hostedMeetups,
    // Belt-and-suspenders: never attach going data on public views.
    goingMeetups: self ? goingMeetups : [],
  };
}
