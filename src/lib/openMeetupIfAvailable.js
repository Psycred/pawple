/** True when id is not a Supabase UUID (demo / seed rows). */
function isDemoMeetupId(meetupId) {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(meetupId ?? ''),
  );
}

/**
 * Open Meetup Details only when the meetup row is still fetchable.
 * Host/Joined lists may briefly show stale cards; this guards navigation.
 *
 * @param {object} params
 * @param {object} params.navigation — React Navigation object with navigate()
 * @param {string} [params.meetupId]
 * @param {object} [params.meetup] — optional seed row from the list card
 * @param {() => void} [params.onUnavailable] — called when meetup cannot be opened
 * @param {(id: string) => Promise<object|null>} [params.fetchById]
 * @returns {Promise<boolean>} true when navigation occurred
 */
export async function openMeetupIfAvailable({
  navigation,
  meetupId,
  meetup,
  onUnavailable,
  fetchById,
}) {
  const id = meetupId ?? meetup?.id;
  if (!id || !navigation?.navigate) {
    onUnavailable?.();
    return false;
  }

  if (isDemoMeetupId(id)) {
    navigation.navigate('MeetupDetailsScreen', { meetupId: id, meetup });
    return true;
  }

  try {
    const resolveFetch =
      fetchById ??
      (async (targetId) => {
        const { fetchMeetupById } = await import('../services/meetups');
        return fetchMeetupById(targetId);
      });
    const row = await resolveFetch(id);
    if (!row) {
      onUnavailable?.();
      return false;
    }

    navigation.navigate('MeetupDetailsScreen', { meetupId: id, meetup: row });
    return true;
  } catch (error) {
    console.error('[Meetup] availability check failed', error);
    onUnavailable?.();
    return false;
  }
}
