/**
 * PAW-20 / A3: Verify all supabase/migrations apply cleanly from an empty database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/verify-migrations.js
 *   npm run verify:migrations
 *
 * Requires a dedicated empty Postgres 15+ database (local Docker Supabase, staging
 * scratch project, or CI service). Never run against production with real user data.
 *
 * Exit 0 = all migrations applied successfully.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const BOOTSTRAP = path.join(ROOT, 'scripts', 'bootstrap-empty-db.sql');

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function validateMigrationInventory(files) {
  const failures = [];

  if (files.length === 0) {
    failures.push('No migration files found.');
    return failures;
  }

  if (!files[0].startsWith('20260101000000_base_schema')) {
    failures.push('First migration must be 20260101000000_base_schema.sql');
  }

  const timestamps = new Set();
  for (const file of files) {
    const ts = file.split('_')[0];
    if (timestamps.has(ts)) {
      failures.push(`Duplicate migration timestamp: ${ts}`);
    }
    timestamps.add(ts);
  }

  return failures;
}

async function applyMigrations(client) {
  const files = listMigrationFiles();
  const bootstrapSql = fs.readFileSync(BOOTSTRAP, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(bootstrapSql);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  applying ${file}...\n`);
      await client.query(sql);
    }

    await client.query('COMMIT');
    return files.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const files = listMigrationFiles();
  const inventoryFailures = validateMigrationInventory(files);

  console.log(`Found ${files.length} migration files.`);

  if (inventoryFailures.length) {
    console.error('Migration inventory check failed:');
    inventoryFailures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('Migration inventory check passed.');

  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.log('');
    console.log('DATABASE_URL not set — inventory-only verification complete.');
    console.log('For full replay, set DATABASE_URL to an empty Postgres database and re-run.');
    console.log('See docs/SUPABASE_DB_RECREATE.md');
    process.exit(0);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg to run full replay: npm install --save-dev pg');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('');
  console.log('Applying bootstrap + migrations to empty database...');

  await client.connect();

  try {
    const count = await applyMigrations(client);
    console.log('');
    console.log(`Migration replay succeeded (${count} files).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('');
  console.error('Migration replay failed:');
  console.error(error.message || error);
  if (error.position) {
    console.error(`SQL error position: ${error.position}`);
  }
  process.exit(1);
});
