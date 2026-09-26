import type { Device } from '../types/device';
import { isDisplayFeedDevice } from './displayFeedDevice';

/**
 * Resolves which feed sits beneath a keyed Regal Display overlay.
 * - Display on PST → PGM (program) shows through keyed green
 * - Display on PGM → Sub (aux) camera shows through keyed green
 * - Other keyed sources → Sub (aux) as before
 */
export function resolveKeyFillDevice(options: {
  keyedDevice: Device | null;
  subDevice: Device | null;
  pgmDevice: Device | null;
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
}): Device | null {
  const { keyedDevice, subDevice, pgmDevice, pstDeviceId, pgmDeviceId } = options;
  if (!keyedDevice) return subDevice;

  if (isDisplayFeedDevice(keyedDevice)) {
    if (
      pstDeviceId &&
      keyedDevice.deviceId === pstDeviceId &&
      pgmDevice &&
      pgmDevice.deviceId !== keyedDevice.deviceId
    ) {
      return pgmDevice;
    }
    if (
      pgmDeviceId &&
      keyedDevice.deviceId === pgmDeviceId &&
      subDevice &&
      subDevice.deviceId !== keyedDevice.deviceId
    ) {
      return subDevice;
    }
    return pgmDevice ?? subDevice;
  }

  return subDevice;
}
