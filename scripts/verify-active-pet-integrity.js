/**
 * Static verification for Fix 3C — active-pet deletion integrity.
 * Run: node scripts/verify-active-pet-integrity.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const context = read('src/contexts/ActivePetContext.js');
assert(
  context.includes('resolveInitialActivePetId'),
  'ActivePetContext must validate saved active pet on init',
);
assert(
  context.includes("export const useActivePet = () => useContext(ActivePetContext)") &&
    context.includes('setPet') &&
    !context.match(/value=\{\{[^}]*setActivePetId/),
  'ActivePetContext must export setPet, not setActivePetId',
);

const editPet = read('src/screens/EditPetScreen.js');
const managePets = read('src/screens/ManagePetsScreen.js');
assert(!editPet.includes('setActivePetId('), 'EditPetScreen must not call setActivePetId');
assert(!managePets.includes('setActivePetId('), 'ManagePetsScreen must not call setActivePetId');
assert(editPet.includes('setPet'), 'EditPetScreen must use setPet');
assert(managePets.includes('setPet'), 'ManagePetsScreen must use setPet');

const createMoment = read('src/screens/CreateMomentScreen.js');
assert(!createMoment.includes('— Tyson'), 'CreateMomentScreen must not fake a pet attribution');
assert(
  createMoment.includes('Add a pet to frame a moment'),
  'CreateMomentScreen must show a calm no-pet line',
);

if (failures.length) {
  console.error('Active-pet integrity verification failed:\n');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('Active-pet integrity verification passed.');
