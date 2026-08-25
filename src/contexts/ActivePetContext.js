import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

const ActivePetContext = createContext();

export const ActivePetProvider = ({ children }) => {
  const { user, authLoading } = useAuth();
  const [activePetId, setActivePetId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (authLoading) {
        return;
      }
      if (!user?.id) {
        setActivePetId(null);
        setLoading(false);
        return;
      }
      try {
        const savedId = await AsyncStorage.getItem('activePetId');
        if (savedId) {
          console.log('[PetContext] Loaded', savedId);
          setActivePetId(savedId);
          return;
        }

        const { data: pets, error } = await supabase
          .from('pets')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) {
          throw error;
        }

        if (pets?.length > 0) {
          const firstPetId = String(pets[0].id);
          setActivePetId(firstPetId);
          await AsyncStorage.setItem('activePetId', firstPetId);
          console.log('[PetContext] Loaded', firstPetId);
        }
      } catch (e) {
        console.error('[PetContext] Init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [authLoading, user]);

  const setPet = async (id) => {
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
  };

  return <ActivePetContext.Provider value={{ activePetId, setPet, loading }}>{children}</ActivePetContext.Provider>;
};

export const useActivePet = () => useContext(ActivePetContext);

export default ActivePetContext;
