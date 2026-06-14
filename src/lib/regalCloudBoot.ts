/** Minimum time the boot screen stays visible once shown. */
export const REGAL_CLOUD_BOOT_MIN_MS = 2000;

const BOOT_DONE_KEY = 'cloudcast-boot-done';

export function isRegalCloudBootDoneThisSession(): boolean {
  try {
    return sessionStorage.getItem(BOOT_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRegalCloudBootDoneThisSession(): void {
  try {
    sessionStorage.setItem(BOOT_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Cleared on sign-out so the next session gets the boot screen again. */
export function clearRegalCloudBootSession(): void {
  try {
    sessionStorage.removeItem(BOOT_DONE_KEY);
  } catch {
    /* ignore */
  }
}
