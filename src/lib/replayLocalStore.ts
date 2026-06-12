import type { ReplayBankSlot } from '../types/replay';

const DB_NAME = 'cloudcast_replay';
const DB_VERSION = 1;
const BANKS_KEY = 'banks';
const CLIPS_STORE = 'clips';

interface StoredClipMeta {
  bankIndex: number;
  mimeType: string;
  durationSec: number;
  inSec: number;
  outSec: number;
  sourceLabel: string;
  sourceDeviceId?: string;
  tags: string[];
  createdAt: string;
  synced: boolean;
  cloudId?: string;
  storagePath?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CLIPS_STORE)) {
        db.createObjectStore(CLIPS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function persistReplayBanks(banks: ReplayBankSlot[]): Promise<void> {
  const db = await openDb();
  const meta: StoredClipMeta[] = [];

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CLIPS_STORE, 'readwrite');
    const store = tx.objectStore(CLIPS_STORE);

    for (let i = 0; i < banks.length; i++) {
      const clip = banks[i]?.clip;
      const blobKey = `bank-${i}`;
      if (clip) {
        store.put(clip.blob, blobKey);
        meta.push({
          bankIndex: i,
          mimeType: clip.mimeType,
          durationSec: clip.durationSec,
          inSec: clip.inSec,
          outSec: clip.outSec,
          sourceLabel: clip.sourceLabel,
          sourceDeviceId: clip.sourceDeviceId,
          tags: clip.tags ?? [],
          createdAt: clip.createdAt,
          synced: clip.synced,
          cloudId: clip.cloudId,
          storagePath: clip.storagePath,
        });
      } else {
        store.delete(blobKey);
      }
    }

    store.put(meta, BANKS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function loadReplayBanksFromLocal(): Promise<ReplayBankSlot[]> {
  const db = await openDb();
  const meta = await new Promise<StoredClipMeta[]>((resolve, reject) => {
    const tx = db.transaction(CLIPS_STORE, 'readonly');
    const req = tx.objectStore(CLIPS_STORE).get(BANKS_KEY);
    req.onsuccess = () => resolve((req.result as StoredClipMeta[] | undefined) ?? []);
    req.onerror = () => reject(req.error);
  });

  const banks: ReplayBankSlot[] = [];
  for (const m of meta) {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(CLIPS_STORE, 'readonly');
      const req = tx.objectStore(CLIPS_STORE).get(`bank-${m.bankIndex}`);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!blob) continue;
    while (banks.length <= m.bankIndex) {
      banks.push({
        id: crypto.randomUUID(),
        index: banks.length,
        label: `Bank ${banks.length + 1}`,
        clip: null,
      });
    }
    const blobUrl = URL.createObjectURL(blob);
    banks[m.bankIndex] = {
      ...banks[m.bankIndex]!,
      clip: {
        id: crypto.randomUUID(),
        blob,
        blobUrl,
        mimeType: m.mimeType,
        durationSec: m.durationSec,
        inSec: m.inSec,
        outSec: m.outSec,
        sourceLabel: m.sourceLabel,
        sourceDeviceId: m.sourceDeviceId,
        tags: m.tags,
        createdAt: m.createdAt,
        synced: m.synced,
        cloudId: m.cloudId,
        storagePath: m.storagePath,
      },
    };
  }

  db.close();
  return banks;
}
