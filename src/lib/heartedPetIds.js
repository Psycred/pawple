/**
 * Collect pet ids from a likes → moments embed (Feed heart-priority helper).
 * @param {Array<{ moments?: { pet_ids?: string[] }|null, moment?: { pet_ids?: string[] }|null }>} rows
 * @returns {Set<string>}
 */
export function collectHeartedPetIdsFromLikesEmbed(rows = []) {
  const petIds = new Set();
  for (const row of rows ?? []) {
    const moment = row?.moments ?? row?.moment ?? null;
    const ids = moment?.pet_ids ?? [];
    if (!Array.isArray(ids)) {
      continue;
    }
    for (const id of ids) {
      if (id) {
        petIds.add(String(id));
      }
    }
  }
  return petIds;
}
