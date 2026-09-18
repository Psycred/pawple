/**
 * Read-only live schema marker probes (PAW-171).
 * Uses EXPO_PUBLIC_* from .env.production — no writes, no delete RPC calls.
 */
const fs = require('fs');
const path = require('path');

function loadEnvProduction() {
  const envPath = path.join(__dirname, '..', '.env.production');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.production missing');
  }
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  return vars;
}

async function probeTableColumn(baseUrl, anonKey, table, column) {
  const url = `${baseUrl}/rest/v1/${table}?select=${column}&limit=0`;
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  const body = await res.text();
  let code = null;
  try {
    const j = JSON.parse(body);
    code = j.code;
  } catch {
    /* ignore */
  }
  return { table, column, status: res.status, code, ok: res.ok };
}

async function probeRpc(baseUrl, anonKey, fn, args = {}) {
  const url = `${baseUrl}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  let code = null;
  try {
    const j = JSON.parse(body);
    code = j.code;
  } catch {
    /* ignore */
  }
  return { fn, status: res.status, code, ok: res.ok };
}

async function main() {
  const env = loadEnvProduction();
  const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL/ANON_KEY required in .env.production');
  }

  const columnProbes = [
    ['meetups', 'id'],
    ['meetup_hosts', 'meetup_id'],
    ['meetup_participants', 'pet_id'],
    ['paw_interests', 'to_owner_id'],
    ['mating_introduction_channels', 'id'],
    ['profiles', 'onboarding_completed'],
    ['pets', 'traits'],
    ['posts', 'created_by'],
    ['posts', 'user_id'],
    ['invites', 'used_by_user_id'],
  ];

  const rpcProbes = [
    'delete_user_account',
    '_delete_caller_storage_objects',
    '_delete_caller_auth_user',
    '_delete_owned_rows',
    '_owned_meetup_ids',
    'export_user_data',
  ];

  console.log('=== Column probes ===');
  for (const [table, column] of columnProbes) {
    const r = await probeTableColumn(baseUrl, anonKey, table, column);
    console.log(
      `${table}.${column}: HTTP ${r.status}${r.code ? ` (${r.code})` : ''}`,
    );
  }

  console.log('\n=== RPC probes (anon) ===');
  for (const fn of rpcProbes) {
    const args =
      fn === '_delete_caller_storage_objects' || fn === '_delete_caller_auth_user'
        ? { p_user_id: '00000000-0000-0000-0000-000000000000' }
        : fn === '_delete_owned_rows'
          ? { p_table: 'posts', p_user_id: '00000000-0000-0000-0000-000000000000', p_columns: ['user_id'] }
          : fn === '_owned_meetup_ids'
            ? { p_user_id: '00000000-0000-0000-0000-000000000000' }
            : {};
    const r = await probeRpc(baseUrl, anonKey, fn, args);
    console.log(`${fn}: HTTP ${r.status}${r.code ? ` (${r.code})` : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
