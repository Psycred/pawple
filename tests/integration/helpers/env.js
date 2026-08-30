/**
 * Integration test environment — never commit secrets.
 *
 * Required for live smoke tests (CI / staging):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY  (setup/teardown only; never ship to the app)
 *
 * Optional:
 *   SUPABASE_INTEGRATION=1     force-run when keys are present (default: auto)
 */

const DEFAULT_URL = 'https://pexurgcfkxkouthuhlnb.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleHVyZ2Nma3hrb3V0aHVobG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDYyMzUsImV4cCI6MjA5MjUyMjIzNX0.4bQNTHSdYtW5rOOpZXXoNG3gJq2kaMd-cPHmkB8-_Go';

export function getIntegrationEnv() {
  const url = process.env.SUPABASE_URL?.trim() || DEFAULT_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || DEFAULT_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const enabled =
    process.env.SUPABASE_INTEGRATION === '1' ||
    process.env.SUPABASE_INTEGRATION === 'true' ||
    Boolean(serviceRoleKey);

  return {
    url,
    anonKey,
    serviceRoleKey,
    enabled,
    hasServiceRole: Boolean(serviceRoleKey),
  };
}

export function skipReason(env) {
  if (!env.hasServiceRole) {
    return 'Set SUPABASE_SERVICE_ROLE_KEY to run RLS-sensitive integration smoke tests (see tests/integration/README.md).';
  }
  return null;
}
