import type { BrowserFeedRole } from '../types/browserFeed';
import type { MediaFeedRole } from './mediaFeedState';

export interface ShotFeedRoles {
  mediaFeedRole: MediaFeedRole;
  browserFeedRole: BrowserFeedRole;
}

/** Map a tile/monitor to the correct Media + Browser bus roles. */
export function shotFeedRolesForTile(
  deviceId: string | null | undefined,
  pstDeviceId: string | null,
  pgmDeviceId: string | null,
  options?: { captureClone?: boolean; monitorLabel?: 'PST' | 'PGM' },
): ShotFeedRoles {
  if (options?.captureClone) {
    if (options.monitorLabel === 'PGM') {
      return { mediaFeedRole: 'pgm', browserFeedRole: 'strip' };
    }
    return { mediaFeedRole: 'strip', browserFeedRole: 'strip' };
  }

  const isPgm = Boolean(deviceId && pgmDeviceId && deviceId === pgmDeviceId);
  const isPst = Boolean(deviceId && pstDeviceId && deviceId === pstDeviceId);

  if (options?.monitorLabel === 'PGM' || isPgm) {
    return { mediaFeedRole: 'pgm', browserFeedRole: 'pgm' };
  }
  if (options?.monitorLabel === 'PST' || isPst) {
    return { mediaFeedRole: 'pst', browserFeedRole: 'pst' };
  }

  return { mediaFeedRole: 'strip', browserFeedRole: 'strip' };
}

/** Roles for a device referenced by id (transition legs, PiP, etc.). */
export function shotFeedRolesForDevice(
  deviceId: string | null | undefined,
  pstDeviceId: string | null,
  pgmDeviceId: string | null,
): ShotFeedRoles {
  return shotFeedRolesForTile(deviceId, pstDeviceId, pgmDeviceId);
}
