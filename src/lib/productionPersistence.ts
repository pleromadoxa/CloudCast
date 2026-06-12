import type { DashboardControls } from '../types/controls';

const STORAGE_KEY = 'cloudcast-production-state';

/** Resume ON AIR broadcast after a dashboard reload (within this window). */
export const BROADCAST_RESUME_MAX_MS = 6 * 60 * 60 * 1000;

export type PersistedProductionState = Pick<
  DashboardControls,
  | 'pstDeviceId'
  | 'pgmDeviceId'
  | 'subDeviceId'
  | 'outputMode'
  | 'activePanel'
  | 'openPanels'
  | 'defaultQuality'
  | 'viewMode'
  | 'globalOverlay'
  | 'display'
  | 'pip'
  | 'key'
  | 'audio'
  | 'transition'
  | 'isOnAir'
> & {
  /** Epoch ms when broadcast last went ON AIR — used to expire stale resume intent. */
  onAirStartedAt?: number | null;
};

export function shouldResumeBroadcast(state: Partial<PersistedProductionState> | null): boolean {
  if (!state?.isOnAir) return false;
  const started = state.onAirStartedAt;
  if (!started) return true;
  return Date.now() - started < BROADCAST_RESUME_MAX_MS;
}

export function loadProductionState(): Partial<PersistedProductionState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedProductionState>;
  } catch {
    return null;
  }
}

export function saveProductionState(state: PersistedProductionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function pickPersistedProduction(
  controls: DashboardControls,
  onAirStartedAt?: number | null,
): PersistedProductionState {
  return {
    pstDeviceId: controls.pstDeviceId,
    pgmDeviceId: controls.pgmDeviceId,
    subDeviceId: controls.subDeviceId,
    outputMode: controls.outputMode,
    activePanel: controls.activePanel,
    openPanels: controls.openPanels,
    defaultQuality: controls.defaultQuality,
    viewMode: controls.viewMode,
    globalOverlay: controls.globalOverlay,
    display: controls.display,
    pip: controls.pip,
    key: controls.key,
    audio: controls.audio,
    isOnAir: controls.isOnAir,
    onAirStartedAt: controls.isOnAir ? (onAirStartedAt ?? null) : null,
    transition: {
      ...controls.transition,
      isAnimating: false,
      progress: 0,
      fadeToBlackLevel: 0,
    },
  };
}
