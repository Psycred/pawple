import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { resolveInitialActivePetId } from '../lib/activePetIntegrity';
import { useAuth } from './AuthContext';

const ActivePetContext = createContext();

export const ActivePetProvider = ({ children }) => {
  const { user, authLoading } = useAuth();
  const [activePetId, setActivePetId] = useState(null);
  const [loading, setLoading] = useState(true);

  const setPet = useCallback(async (id) => {
    const petId = id == null ? null : String(id);
    setActivePetId(petId);
    console.log('[PetContext] Switched to', id);
    try {
      if (petId == null) {
        await AsyncStorage.removeItem('activePetId');
      } else {
        await AsyncStorage.setItem('activePetId', petId);
      }
    } catch (e) {
      console.warn('[PetContext] Persist failed', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (authLoading) {
        return;
      }
      if (!user?.id) {
        await setPet(null);
        setLoading(false);
        return;
      }
      try {
        const savedId = await AsyncStorage.getItem('activePetId');

        const { data: pets, error } = await supabase
          .from('pets')
          .select('id, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        const resolvedId = resolveInitialActivePetId(savedId, pets);

        if (savedId && String(resolvedId) !== String(savedId)) {
          console.log('[PetContext] Healed stale active pet', savedId, '->', resolvedId);
        } else if (resolvedId) {
          console.log('[PetContext] Loaded', resolvedId);
        }

        await setPet(resolvedId);
      } catch (e) {
        console.error('[PetContext] Init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [authLoading, setPet, user]);

  return <ActivePetContext.Provider value={{ activePetId, setPet, loading }}>{children}</ActivePetContext.Provider>;
};

export const useActivePet = () => useContext(ActivePetContext);

export default ActivePetContext;
