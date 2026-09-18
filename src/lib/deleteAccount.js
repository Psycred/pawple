import { supabase } from '../config/supabase';
import { PET_PHOTOS_BUCKET } from './petPhotoUpload';
import { SHARE_PREVIEWS_BUCKET } from './storageMediaParse';
import { signOutUser } from './authSession';

const USER_STORAGE_BUCKETS = ['moments', PET_PHOTOS_BUCKET, SHARE_PREVIEWS_BUCKET];
const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;

/**
 * List object paths under `{userId}/` in owner-scoped buckets (see src/lib/supabase.js).
 */
async function listUserStoragePaths(bucket, userId) {
  const paths = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
    });
    if (error) {
      throw error;
    }
    if (!data?.length) {
      break;
    }

    for (const item of data) {
      if (item?.name && item.id) {
        paths.push(`${userId}/${item.name}`);
      }
    }

    if (data.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }
    offset += STORAGE_LIST_PAGE_SIZE;
  }

  return paths;
}

/**
 * Client-side storage cleanup before the delete RPC (F4).
 * Best-effort: RPC still owns canonical deletion if this step misses objects.
 */
async function purgeUserStorageBeforeDelete(userId) {
  for (const bucket of USER_STORAGE_BUCKETS) {
    try {
      const paths = await listUserStoragePaths(bucket, userId);
      if (!paths.length) {
        continue;
      }

      for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
        const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
        const { error } = await supabase.storage.from(bucket).remove(batch);
        if (error) {
          console.error('[Supabase]', error);
        }
      }
    } catch (error) {
      console.error('[DeleteAccount] Storage cleanup failed', { bucket, userId, error });
    }
  }
}

/**
 * Server-controlled account deletion (Product Contract §10).
 * C5 wires Settings UI; this helper is the canonical client invocation path.
 */
export async function deleteAccount({ signOutAfter = true } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Not signed in');
  }

  await purgeUserStorageBeforeDelete(user.id);

  const { data, error } = await supabase.rpc('delete_user_account');
  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error('Account deletion did not complete');
  }

  if (!data.already_deleted) {
    const authUsersDeleted = Number(data?.counts?.auth_users ?? 0);
    const profilesDeleted = Number(data?.counts?.profiles ?? 0);
    if (authUsersDeleted < 1 || profilesDeleted < 1) {
      console.error('[DeleteAccount] RPC returned ok without deleting auth/profile', data);
      throw new Error('Account deletion did not complete');
    }
  }

  if (signOutAfter) {
    await signOutUser(user.id);
  }

  return data;
}
