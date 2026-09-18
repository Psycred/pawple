import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Active pet startup identity hydration', () => {
  const context = readSrc('src/contexts/ActivePetContext.js');
  const header = readSrc('src/components/AppHeader.js');
  const selector = readSrc('src/components/PetSelector.js');
  const tabs = readSrc('src/navigation/BottomTabNavigator.js');
  const feed = readSrc('src/screens/FeedScreen.js');

  it('loads feed-ready pet fields in ActivePetContext', () => {
    assert.match(context, /USER_PETS_SELECT = 'id, name, photo_url, pet_type, breed, created_at'/);
    assert.match(context, /activePet,/);
    assert.match(context, /toActivePetSnapshot/);
    assert.match(context, /setActivePet\(toActivePetSnapshot\(resolvedPet\)\)/);
  });

  it('exposes activePet and userPets through useActivePet for consumers', () => {
    assert.match(context, /userPets,/);
    assert.match(context, /refreshUserPets/);
    assert.match(context, /value=\{\{ activePetId, activePet, userPets, setPet, refreshUserPets, loading \}\}/);
  });

  it('uses ActivePetContext identity in AppHeader instead of startup pets fetch', () => {
    assert.match(header, /const \{ activePetId, activePet, setPet, loading: activePetLoading \} = useActivePet\(\)/);
    assert.match(header, /pet=\{activePet\}/);
    assert.doesNotMatch(header, /FETCH_DEBOUNCE_MS/);
    assert.doesNotMatch(header, /debouncedFetchPets/);
    assert.doesNotMatch(header, /useEffect\(\(\) => \{\s*fetchPets\(\)/);
  });

  it('retains a fresh pets fetch for the pet-switcher modal only', () => {
    assert.match(header, /const fetchPets = useCallback/);
    assert.match(header, /fetchPets\(\);\s*\n\s*setModalVisible\(true\)/);
    assert.match(header, /select\('id, name, photo_url'\)/);
  });

  it('does not use "Your pet" as the normal header identity fallback', () => {
    assert.doesNotMatch(header, /'Your pet'/);
    assert.doesNotMatch(selector, /'Your pet'/);
    assert.match(selector, /trimmedName \|\| 'Pets'/);
  });

  it('uses ActivePetContext identity in BottomTabNavigator', () => {
    assert.match(tabs, /const \{ activePetId, activePet \} = useActivePet\(\)/);
    assert.match(tabs, /formatPetTabLabel\(activePet\?\.name\)/);
    assert.match(tabs, /photoUrl=\{activePet\?\.photo_url\}/);
    assert.match(tabs, /name=\{activePet\?\.name\}/);
    assert.doesNotMatch(tabs, /\.select\('name, photo_url'\)/);
  });

  it('reads viewer pets from ActivePetContext instead of a Feed-only pets query', () => {
    assert.match(feed, /const \{ userPets: viewerPets, refreshUserPets \} = useActivePet\(\)/);
    assert.doesNotMatch(feed, /select\('id, name, photo_url, pet_type, breed'\)/);
    assert.match(feed, /refreshUserPets\(\)/);
  });
});
