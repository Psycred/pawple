/**
 * Format hosting pet names for meetup cards and detail surfaces.
 */

/**
 * @param {string[]} names
 * @returns {string}
 */
export function formatHostPetNames(names = []) {
  const list = names.map((n) => String(n).trim()).filter(Boolean);
  if (list.length === 0) {
    return '';
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} & ${list[1]}`;
  }
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

/**
 * "Hosted by Tyson" | "Hosted by Tyson & Bella"
 * @param {{ meetup_hosts?: Array<{ pets?: { name?: string } }> }} meetup
 * @returns {string}
 */
export function formatMeetupHostedByLine(meetup) {
  const names = extractHostPetNames(meetup?.meetup_hosts ?? []);
  const formatted = formatHostPetNames(names);
  if (!formatted) {
    return '';
  }

  return `Hosted by ${formatted}`;
}

/**
 * Extract pet names from meetup_hosts embed rows.
 * @param {Array<{ pet_id?: string, pets?: { name?: string } }>} hostRows
 * @returns {string[]}
 */
export function extractHostPetNames(hostRows) {
  if (!Array.isArray(hostRows)) {
    return [];
  }
  return hostRows
    .map((row) => row?.pets?.name ?? row?.pet_name ?? null)
    .filter(Boolean)
    .map((name) => String(name).trim())
    .filter(Boolean);
}

/**
 * Meetup card copy — primary host is the first meetup_hosts row (creator profile pet).
 * 1 host: "Hosted by Tyson"
 * 2 hosts: "Hosted by Tyson • Bella"
 * 3+ hosts: "Hosted by Tyson + 2"
 * @param {{ meetup_hosts?: Array<{ pet_id?: string, pets?: { name?: string } }> }} meetup
 * @returns {string}
 */
export function formatMeetupCardHostedByLine(meetup) {
  const names = extractHostPetNames(meetup?.meetup_hosts ?? []);
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return `Hosted by ${names[0]}`;
  }
  if (names.length === 2) {
    return `Hosted by ${names[0]} • ${names[1]}`;
  }
  return `Hosted by ${names[0]} + ${names.length - 1}`;
}
