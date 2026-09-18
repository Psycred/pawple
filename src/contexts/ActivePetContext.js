import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { resolveInitialActivePetId } from '../lib/activePetIntegrity';
import { useAuth } from './AuthContext';

const ActivePetContext = createContext();

const USER_PETS_SELECT = 'id, name, photo_url, pet_type, breed, created_at';

function toActivePetSnapshot(pet) {
  if (!pet?.id) {
    return null;
  }
  return {
    id: String(pet.id),
    name: pet.name ?? null,
    photo_url: pet.photo_url ?? null,
  };
}

async function persistActivePetId(petId) {
  try {
    if (petId == null) {
      await AsyncStorage.removeItem('activePetId');
    } else {
      await AsyncStorage.setItem('activePetId', String(petId));
    }
  } catch (e) {
    console.warn('[PetContext] Persist failed', e);
  }
}

export const ActivePetProvider = ({ children }) => {
  const { user, authLoading } = useAuth();
  const [activePetId, setActivePetId] = useState(null);
  const [activePet, setActivePet] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshUserPets = useCallback(async () => {
    if (!user?.id) {
      setUserPets([]);
      return [];
    }

    const { data: pets, error } = await supabase
      .from('pets')
      .select(USER_PETS_SELECT)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = pets ?? [];
    setUserPets(rows);

    setActivePet((current) => {
      if (!current?.id) {
        return current;
      }
      const match = rows.find((pet) => String(pet.id) === String(current.id));
      return match ? toActivePetSnapshot(match) : current;
    });

    return rows;
  }, [user?.id]);

  const resolveActivePetSnapshot = useCallback(async (petId, petsList = userPets) => {
    if (!petId) {
      return null;
    }

    const fromList = petsList.find((pet) => String(pet.id) === String(petId));
    if (fromList) {
      return toActivePetSnapshot(fromList);
    }

    const { data, error } = await supabase
      .from('pets')
      .select('id, name, photo_url')
      .eq('id', petId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return toActivePetSnapshot(data);
  }, [userPets]);

  const setPet = useCallback(
    async (id, petSnapshot = null) => {
      const petId = id == null ? null : String(id);
      setActivePetId(petId);
      console.log('[PetContext] Switched to', id);

      if (petId == null) {
        setActivePet(null);
        await persistActivePetId(null);
        return;
      }

      if (petSnapshot?.id) {
        setActivePet(toActivePetSnapshot(petSnapshot));
      } else {
        try {
          const snapshot = await resolveActivePetSnapshot(petId);
          setActivePet(snapshot);
          if (snapshot) {
            setUserPets((current) => {
              if (current.some((pet) => String(pet.id) === String(snapshot.id))) {
                return current;
              }
              return [...current, snapshot];
            });
          }
        } catch (e) {
          console.error('[PetContext] Active pet snapshot error', e);
          setActivePet(null);
        }
      }

      await persistActivePetId(petId);
    },
    [resolveActivePetSnapshot],
  );

  useEffect(() => {
    const init = async () => {
      if (authLoading) {
        return;
      }
      if (!user?.id) {
        setActivePetId(null);
        setActivePet(null);
        setUserPets([]);
        await persistActivePetId(null);
        setLoading(false);
        return;
      }
      try {
        const savedId = await AsyncStorage.getItem('activePetId');

        const { data: pets, error } = await supabase
          .from('pets')
          .select(USER_PETS_SELECT)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        const rows = pets ?? [];
        const resolvedId = resolveInitialActivePetId(savedId, rows);
        const resolvedPet = rows.find((pet) => String(pet.id) === String(resolvedId)) ?? null;

        if (savedId && String(resolvedId) !== String(savedId)) {
          console.log('[PetContext] Healed stale active pet', savedId, '->', resolvedId);
        } else if (resolvedId) {
          console.log('[PetContext] Loaded', resolvedId);
        }

        setUserPets(rows);
        setActivePetId(resolvedId);
        setActivePet(toActivePetSnapshot(resolvedPet));
        await persistActivePetId(resolvedId);
      } catch (e) {
        console.error('[PetContext] Init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [authLoading, user]);

  return (
    <ActivePetContext.Provider
      value={{ activePetId, activePet, userPets, setPet, refreshUserPets, loading }}
    >
      {children}
    </ActivePetContext.Provider>
  );
};

export const useActivePet = () => useContext(ActivePetContext);

export default ActivePetContext;
