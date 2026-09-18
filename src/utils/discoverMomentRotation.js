/** Mirror of moments.js normalizePetIds — kept local so rotation helpers stay unit-testable. */
function normalizePetIds(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        return JSON.parse(t).map(String);
      } catch {
        // fall through to comma parsing
      }
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Stable featured-moment window before recycling to another eligible moment. */
export const DISCOVER_MOMENT_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;

function discoverRotationSeed(viewerPetId, candidatePetId, nowMs = Date.now()) {
  const bucket = Math.floor(nowMs / DISCOVER_MOMENT_ROTATION_MS);
  const key = `${String(viewerPetId ?? '')}|${String(candidatePetId ?? '')}|${bucket}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Moments eligible for a discover card: tagged to the candidate, never the viewer's pet.
 */
export function filterDiscoverEligibleMoments(moments, candidatePetId, viewerPetId) {
  const candidateKey = String(candidatePetId ?? '');
  const viewerKey = String(viewerPetId ?? '');
  if (!candidateKey) {
    return [];
  }

  return (moments ?? []).filter((moment) => {
    const petIds = normalizePetIds(moment?.pet_ids);
    if (!petIds.includes(candidateKey)) {
      return false;
    }
    if (viewerKey && petIds.includes(viewerKey)) {
      return false;
    }
    const photo = moment?.image_url ?? moment?.photo_url ?? null;
    return Boolean(String(photo ?? '').trim());
  });
}

/**
 * Pick one moment for a discover card with ~7-day stable rotation.
 */
export function pickDiscoverMomentForCandidate(
  moments,
  viewerPetId,
  candidatePetId,
  nowMs = Date.now(),
) {
  const eligible = filterDiscoverEligibleMoments(moments, candidatePetId, viewerPetId);
  if (!eligible.length) {
    return null;
  }

  const sorted = [...eligible].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const seed = discoverRotationSeed(viewerPetId, candidatePetId, nowMs);
  return sorted[seed % sorted.length];
}
