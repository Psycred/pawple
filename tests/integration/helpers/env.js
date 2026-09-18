/**
 * Integration test environment — never commit secrets.
 *
 * Required for smoke tests (staging / dedicated scratch only):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY  (setup/teardown only; never ship to the app)
 *
 * Optional:
 *   SUPABASE_INTEGRATION=1     force-run when keys are present (default: auto)
 *
 * PAW-170: never default to live production. Client signUp against live is banned.
 */

const LIVE_PROJECT_REF = 'pexurgcfkxkouthuhlnb';

function isLiveProjectUrl(url) {
  if (!url) {
    return false;
  }
  try {
    return new URL(url).hostname.toLowerCase().includes(LIVE_PROJECT_REF);
  } catch {
    return url.toLowerCase().includes(LIVE_PROJECT_REF);
  }
}

export function getIntegrationEnv() {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const live = isLiveProjectUrl(url);
  const hasServiceRole = Boolean(serviceRoleKey);
  const hasExplicitTarget = Boolean(url && anonKey);
  const forceRun =
    process.env.SUPABASE_INTEGRATION === '1' || process.env.SUPABASE_INTEGRATION === 'true';
  const enabled = !live && hasExplicitTarget && hasServiceRole && (forceRun || hasServiceRole);

  return {
    url,
    anonKey,
    serviceRoleKey,
    enabled,
    hasServiceRole,
    isLiveProject: live,
  };
}

export function skipReason(env) {
  if (env.isLiveProject) {
    return 'Integration tests must not target live pexurgcfkxkouthuhlnb. Use a staging or scratch project (PAW-170).';
  }
  if (!env.url || !env.anonKey) {
    return 'Set SUPABASE_URL and SUPABASE_ANON_KEY to a non-production project (see tests/integration/README.md).';
  }
  if (!env.hasServiceRole) {
    return 'Set SUPABASE_SERVICE_ROLE_KEY to run RLS-sensitive integration smoke tests (see tests/integration/README.md).';
  }
  return null;
}
