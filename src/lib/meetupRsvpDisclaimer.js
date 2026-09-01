import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MEETUP_RSVP_DISCLAIMER,
  MEETUP_RSVP_DISCLAIMER_TITLE,
} from '../content/legalDocuments';

/** Device-level ack — Legal copy lives in legalDocuments.js (PAW-101 / PAW-107). */
export const MEETUP_RSVP_DISCLAIMER_ACK_KEY = '@pawple/meetup_rsvp_disclaimer_ack_v1';

export { MEETUP_RSVP_DISCLAIMER, MEETUP_RSVP_DISCLAIMER_TITLE };

export async function hasMeetupRsvpDisclaimerAck() {
  try {
    const ack = await AsyncStorage.getItem(MEETUP_RSVP_DISCLAIMER_ACK_KEY);
    return ack === '1';
  } catch (error) {
    console.error('[MeetupRsvpDisclaimer] read ack', error);
    return false;
  }
}

export async function acknowledgeMeetupRsvpDisclaimer() {
  try {
    await AsyncStorage.setItem(MEETUP_RSVP_DISCLAIMER_ACK_KEY, '1');
  } catch (error) {
    console.error('[MeetupRsvpDisclaimer] write ack', error);
  }
}
