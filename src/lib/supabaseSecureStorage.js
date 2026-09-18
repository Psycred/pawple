import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__chunk_count';

function chunkKey(key, index) {
  return `${key}${CHUNK_COUNT_SUFFIX}_${index}`;
}

async function readChunks(key) {
  const countRaw = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  if (!countRaw) {
    return null;
  }
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, index));
    if (part == null) {
      return null;
    }
    parts.push(part);
  }
  return parts.join('');
}

async function writeChunks(key, value) {
  const chunks = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(chunks.length));
  for (let index = 0; index < chunks.length; index += 1) {
    await SecureStore.setItemAsync(chunkKey(key, index), chunks[index]);
  }
}

async function deleteChunks(key) {
  const countRaw = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  const count = Number(countRaw);
  if (Number.isFinite(count) && count > 0) {
    for (let index = 0; index < count; index += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, index));
    }
  }
  await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
}

async function migrateLegacyAsyncStorageValue(key) {
  try {
    const legacy = await AsyncStorage.getItem(key);
    if (!legacy) {
      return null;
    }
    await writeChunks(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  } catch (error) {
    console.log('[supabaseSecureStorage] legacy migration skipped:', error?.message ?? error);
    return null;
  }
}

/**
 * Supabase auth storage backed by SecureStore (chunked for large sessions).
 * One-time migration from AsyncStorage keeps existing users signed in.
 */
export const supabaseSecureStorage = {
  async getItem(key) {
    try {
      const secure = await readChunks(key);
      if (secure != null) {
        return secure;
      }
      return migrateLegacyAsyncStorageValue(key);
    } catch (error) {
      console.log('[supabaseSecureStorage] getItem fallback:', error?.message ?? error);
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key, value) {
    try {
      await writeChunks(key, value);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.log('[supabaseSecureStorage] setItem fallback:', error?.message ?? error);
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    try {
      await deleteChunks(key);
    } catch (error) {
      console.log('[supabaseSecureStorage] removeItem secure cleanup:', error?.message ?? error);
    }
    await AsyncStorage.removeItem(key);
  },
};
