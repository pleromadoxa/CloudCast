const STORAGE_KEY = 'cloudcast-audio-follow-rundown';

export function getFollowRundownMirrorPref(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setFollowRundownMirrorPref(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}
