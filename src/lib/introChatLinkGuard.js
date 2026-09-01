/**
 * Client mirror of DB introduction_message_body_contains_link — PAW-100 / PAW-105.
 * Keep regex patterns in sync with supabase/migrations/*_phase1a_chat_link_block.sql.
 * Phone numbers remain allowed (organic exchange per product contract).
 */

export const INTRO_CHAT_LINK_FORBIDDEN_MESSAGE = "Links can't be shared here.";

/** Common TLDs — keep in sync with introduction_message_body_contains_link (PAW-100). */
const INTRO_CHAT_BARE_DOMAIN_TLD =
  'com|org|net|io|co|in|uk|app|dev|me|info|biz|edu|gov|tv|xyz|online|site|store|shop|link|click|live|tech|cloud|ai';

const INTRO_CHAT_EXPLICIT_URL_RE = /(https?:\/\/|www\.)/i;
const INTRO_CHAT_BARE_DOMAIN_RE = new RegExp(
  `\\b[a-z0-9][a-z0-9\\-]{0,62}\\.(?:${INTRO_CHAT_BARE_DOMAIN_TLD})(?:[\\s/?#]|$)`,
  'i',
);

export function introductionMessageBodyContainsLink(body) {
  const trimmed = String(body ?? '').trim();
  if (!trimmed) {
    return false;
  }
  return (
    INTRO_CHAT_EXPLICIT_URL_RE.test(trimmed) || INTRO_CHAT_BARE_DOMAIN_RE.test(trimmed)
  );
}
