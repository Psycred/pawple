/**
 * Static audit: env-based Supabase config and EAS build profiles.
 * Run: node scripts/verify-environment-config.js
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

const supabase = read('src/config/supabase.js');
assert(
  supabase.includes('process.env.EXPO_PUBLIC_SUPABASE_URL'),
  'supabase.js must read EXPO_PUBLIC_SUPABASE_URL from env',
);
assert(
  supabase.includes('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  'supabase.js must read EXPO_PUBLIC_SUPABASE_ANON_KEY from env',
);
assert(
  !supabase.includes('pexurgcfkxkouthuhlnb'),
  'supabase.js must not contain hardcoded Supabase project URL',
);
assert(
  !/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/.test(supabase),
  'supabase.js must not contain hardcoded anon key',
);

const environment = read('src/config/environment.js');
assert(environment.includes('export const pawpleEnv'), 'environment.js must export pawpleEnv');
assert(environment.includes('export const isStaging'), 'environment.js must export isStaging');
assert(
  environment.includes('export const isDemoContentEnabled = __DEV__'),
  'environment.js must tie isDemoContentEnabled to __DEV__',
);
assert(
  environment.includes('export function assertContractEnvironment'),
  'environment.js must export assertContractEnvironment',
);

const app = read('App.js');
assert(
  app.includes('assertContractEnvironment'),
  'App.js must call assertContractEnvironment at startup',
);

const eas = JSON.parse(read('eas.json'));
for (const profile of ['development', 'staging', 'production']) {
  assert(
    eas.build?.[profile]?.env?.EXPO_PUBLIC_PAWPLE_ENV === profile,
    `eas.json ${profile} profile must set EXPO_PUBLIC_PAWPLE_ENV=${profile}`,
  );
}

for (const example of ['.env.development.example', '.env.staging.example', '.env.production.example']) {
  assert(fs.existsSync(path.join(root, example)), `${example} must exist`);
}

const gitignore = read('.gitignore');
for (const secretFile of ['.env.development', '.env.staging', '.env.production']) {
  assert(gitignore.includes(secretFile), `.gitignore must ignore ${secretFile}`);
}

if (failures.length) {
  console.error('Environment config verification failed:\n');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('Environment config verification passed.');
console.log('Supabase credentials are env-driven; demo/dev auth remains __DEV__-gated.');
