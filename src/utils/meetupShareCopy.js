function extractHostPetNames(hostRows) {
  if (!Array.isArray(hostRows)) {
    return [];
  }
  return hostRows
    .map((row) => row?.pets?.name ?? row?.pet_name ?? null)
    .filter(Boolean)
    .map((name) => String(name).trim())
    .filter(Boolean);
}

function extractMeetupHostPetIds(meetup) {
  return (meetup?.meetup_hosts ?? [])
    .map((row) => String(row?.pet_id ?? row?.pets?.id ?? ''))
    .filter(Boolean);
}

function extractMeetupAttendeePetIds(meetup) {
  return (meetup?.meetup_participants ?? [])
    .map((row) => String(row?.pet_id ?? row?.pets?.id ?? ''))
    .filter(Boolean);
}

function extractViewerJoinedPetIds(meetup, ownedPetIds = []) {
  const attendeeIds = new Set(extractMeetupAttendeePetIds(meetup));
  return (ownedPetIds ?? []).map(String).filter((id) => attendeeIds.has(id));
}

/**
 * Share sheet copy — hosting vs attending vs third-party observer.
 */
export function buildMeetupShareCaption({
  meetup,
  ownedPetIds = [],
  activePetId = null,
  viewerPets = [],
  shareDateLabel = '',
}) {
  const hostPets = extractHostPetNames(meetup?.meetup_hosts ?? []);
  const creatorPetName = hostPets[0] || 'The host';
  const hostPetIds = new Set(extractMeetupHostPetIds(meetup));
  const joinedPetIds = extractViewerJoinedPetIds(meetup, ownedPetIds);

  const activePet = viewerPets.find((pet) => String(pet?.id) === String(activePetId));
  const sharingPet =
    activePet ||
    viewerPets.find((pet) => joinedPetIds.some((id) => String(id) === String(pet?.id))) ||
    viewerPets.find((pet) => hostPetIds.has(String(pet?.id))) ||
    null;

  const normalizedTitle = String(meetup?.title ?? 'meetup').trim() || 'meetup';
  const article = /^[aeiou]/i.test(normalizedTitle) ? 'an' : 'a';
  const dateSuffix = String(shareDateLabel ?? '').trim();

  const viewerHostingIds = ownedPetIds
    .map(String)
    .filter((id) => hostPetIds.has(id));
  const viewerAttendingIds = joinedPetIds
    .map(String)
    .filter((id) => !hostPetIds.has(id));

  if (sharingPet && viewerHostingIds.includes(String(sharingPet.id))) {
    return `${sharingPet.name} is hosting ${article} ${normalizedTitle}${dateSuffix ? ` ${dateSuffix}` : ''}`;
  }

  if (sharingPet && viewerAttendingIds.includes(String(sharingPet.id))) {
    return `${sharingPet.name} is attending ${creatorPetName}'s ${normalizedTitle}${dateSuffix ? ` ${dateSuffix}` : ''}`;
  }

  return `${creatorPetName} is hosting ${article} ${normalizedTitle}${dateSuffix ? ` ${dateSuffix}` : ''}`;
}
