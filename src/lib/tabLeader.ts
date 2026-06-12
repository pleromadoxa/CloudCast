/** One visible browser tab handles WebRTC signaling to avoid duplicate answers. */

const LOCK_NAME = 'cloudcast-signaling';
const BC_NAME = 'cloudcast-signaling-leader';

export function supportsSignalingLock(): boolean {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

function isTabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Hold the signaling leader lock while this tab is visible.
 * Background tabs release immediately; the visible tab queues for the lock.
 */
export async function holdSignalingLeader(
  onLeaderChange: (isLeader: boolean) => void,
): Promise<() => void> {
  if (!supportsSignalingLock()) {
    onLeaderChange(true);
    return () => onLeaderChange(false);
  }

  let released = false;
  let releaseWaiter: (() => void) | null = null;
  let wakeWaiter: (() => void) | null = null;

  const wakeTryHold = () => {
    wakeWaiter?.();
    wakeWaiter = null;
  };

  const releaseLock = () => {
    releaseWaiter?.();
    releaseWaiter = null;
    wakeTryHold();
  };

  const bc =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BC_NAME) : null;

  bc?.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'wake-leader' && isTabVisible()) {
      wakeTryHold();
    }
  });

  const onVisibility = () => {
    if (!isTabVisible()) {
      onLeaderChange(false);
      releaseLock();
      bc?.postMessage({ type: 'wake-leader' });
    } else {
      wakeTryHold();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);

  const waitForWake = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      wakeWaiter = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  const tryHold = async () => {
    while (!released) {
      if (!isTabVisible()) {
        onLeaderChange(false);
        await waitForWake(200);
        continue;
      }

      await navigator.locks.request(LOCK_NAME, async () => {
        if (released || !isTabVisible()) {
          onLeaderChange(false);
          return;
        }
        onLeaderChange(true);
        await new Promise<void>((resolve) => {
          releaseWaiter = resolve;
        });
        onLeaderChange(false);
      });

      if (!released && isTabVisible()) {
        await waitForWake(50);
      }
    }
  };

  void tryHold();

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibility);
    bc?.close();
    releaseLock();
  };
}
