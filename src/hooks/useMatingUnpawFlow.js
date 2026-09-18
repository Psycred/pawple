import { useCallback, useState } from 'react';
import { supabase } from '../config/supabase';
import {
  fetchOutboundPaw,
  queryMutualPaw,
  unpawMutualIntroduction,
  withdrawPaw,
} from '../services/mating';

/**
 * Shared reversible Mating unpaw flow — confirm, withdraw outbound Paw, optional report prompt.
 * Captures report context before withdraw so the existing report flow still has a target.
 */
export function useMatingUnpawFlow({ viewerPetId, otherPetId, onUnpawComplete }) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [reportContext, setReportContext] = useState(null);
  const [busy, setBusy] = useState(false);

  const requestUnpaw = useCallback(() => {
    setConfirmVisible(true);
  }, []);

  const cancelUnpaw = useCallback(() => {
    if (!busy) {
      setConfirmVisible(false);
    }
  }, [busy]);

  const confirmUnpaw = useCallback(async () => {
    if (!viewerPetId || !otherPetId || busy) {
      return false;
    }
    setBusy(true);
    try {
      let outbound = null;
      try {
        outbound = await fetchOutboundPaw(viewerPetId, otherPetId);
      } catch (e) {
        console.error('[MatingUnpaw] outbound lookup', e);
      }

      let reportedUserId = null;
      try {
        const { data, error } = await supabase
          .from('pets')
          .select('owner_id')
          .eq('id', otherPetId)
          .maybeSingle();
        if (error) {
          console.error('[Supabase]', error);
        } else {
          reportedUserId = data?.owner_id ?? null;
        }
      } catch (e) {
        console.error('[MatingUnpaw] owner lookup', e);
      }

      const mutualCheck = await queryMutualPaw(viewerPetId, otherPetId);
      if (!mutualCheck.ok) {
        throw new Error('mutual_check_failed');
      }
      if (mutualCheck.mutual) {
        await unpawMutualIntroduction(viewerPetId, otherPetId);
      } else {
        await withdrawPaw(viewerPetId, otherPetId);
      }
      setReportContext({
        targetId: outbound?.id ?? null,
        reportedUserId,
      });
      setConfirmVisible(false);
      setReportPromptVisible(true);
      onUnpawComplete?.();
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy, onUnpawComplete, otherPetId, viewerPetId]);

  const dismissReportPrompt = useCallback(() => {
    setReportPromptVisible(false);
    setReportContext(null);
  }, []);

  return {
    confirmVisible,
    reportPromptVisible,
    reportContext,
    busy,
    requestUnpaw,
    cancelUnpaw,
    confirmUnpaw,
    dismissReportPrompt,
  };
}
