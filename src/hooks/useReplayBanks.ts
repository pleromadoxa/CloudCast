import { useCallback, useMemo, useState } from 'react';
import type { ReplayBankSlot, ReplayClipLocal } from '../types/replay';

function createEmptyBank(index: number): ReplayBankSlot {
  return {
    id: crypto.randomUUID(),
    index,
    label: `Bank ${index + 1}`,
    clip: null,
  };
}

export function useReplayBanks(maxBanks: number) {
  const [banks, setBanks] = useState<ReplayBankSlot[]>(() =>
    Array.from({ length: maxBanks }, (_, i) => createEmptyBank(i)),
  );
  const [activeBankIndex, setActiveBankIndex] = useState(0);

  const resizeBanks = useCallback((count: number) => {
    setBanks((prev) => {
      if (prev.length === count) return prev;
      if (prev.length > count) return prev.slice(0, count);
      const next = [...prev];
      for (let i = prev.length; i < count; i++) next.push(createEmptyBank(i));
      return next;
    });
    setActiveBankIndex((i) => Math.min(i, count - 1));
  }, []);

  const saveToBank = useCallback(
    (
      bankIndex: number,
      clip: Omit<ReplayClipLocal, 'id' | 'blobUrl' | 'createdAt' | 'synced'> & { synced?: boolean },
    ) => {
      const blobUrl = URL.createObjectURL(clip.blob);
      const local: ReplayClipLocal = {
        id: crypto.randomUUID(),
        blobUrl,
        createdAt: new Date().toISOString(),
        synced: clip.synced ?? false,
        ...clip,
      };
      setBanks((prev) =>
        prev.map((b, i) => {
          if (i !== bankIndex) return b;
          if (b.clip?.blobUrl) URL.revokeObjectURL(b.clip.blobUrl);
          return { ...b, clip: local };
        }),
      );
      setActiveBankIndex(bankIndex);
      return local;
    },
    [],
  );

  const clearBank = useCallback((bankIndex: number) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== bankIndex) return b;
        if (b.clip?.blobUrl) URL.revokeObjectURL(b.clip.blobUrl);
        return { ...b, clip: null };
      }),
    );
  }, []);

  const loadClipIntoBank = useCallback((bankIndex: number, clip: ReplayClipLocal) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== bankIndex) return b;
        if (b.clip?.blobUrl && b.clip.id !== clip.id) URL.revokeObjectURL(b.clip.blobUrl);
        return { ...b, clip };
      }),
    );
    setActiveBankIndex(bankIndex);
  }, []);

  const markBankSynced = useCallback((bankIndex: number, cloudId: string, storagePath: string) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== bankIndex || !b.clip) return b;
        return { ...b, clip: { ...b.clip, synced: true, cloudId, storagePath } };
      }),
    );
  }, []);

  const restoreBanks = useCallback((loaded: ReplayBankSlot[], bankCount: number) => {
    setBanks(() => {
      const next = Array.from({ length: bankCount }, (_, i) => createEmptyBank(i));
      for (const slot of loaded) {
        if (slot.index < next.length && slot.clip) {
          next[slot.index] = slot;
        }
      }
      return next;
    });
  }, []);

  const activeBank = useMemo(() => banks[activeBankIndex] ?? null, [banks, activeBankIndex]);

  return {
    banks,
    activeBankIndex,
    activeBank,
    setActiveBankIndex,
    resizeBanks,
    saveToBank,
    clearBank,
    loadClipIntoBank,
    markBankSynced,
    restoreBanks,
  };
}
