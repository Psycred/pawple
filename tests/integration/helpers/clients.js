import { createClient } from '@supabase/supabase-js';
import { getIntegrationEnv } from './env.js';

const memoryStorage = () => {
  const store = new Map();
  return {
    getItem: async (key) => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
  };
};

export function createAdminClient() {
  const env = getIntegrationEnv();
  if (env.isLiveProject) {
    throw new Error('Admin client refused: live pexurgcfkxkouthuhlnb is forbidden for integration tests (PAW-170).');
  }
  if (!env.hasServiceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anon client with in-memory session storage (mirrors app auth persistence). */
export function createUserClient(label = 'integration') {
  const env = getIntegrationEnv();
  if (env.isLiveProject) {
    throw new Error('User client refused: live pexurgcfkxkouthuhlnb is forbidden for integration tests (PAW-170).');
  }
  return createClient(env.url, env.anonKey, {
    auth: {
      storage: memoryStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'X-Client-Info': `pawple-integration/${label}` },
    },
  });
}
