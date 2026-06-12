import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';

/** Pick an Aux/Sub source that differs from the main program feed (required for visible PiP). */
export function resolvePipSubDeviceId(
  devices: Device[],
  mainDeviceId: string | null,
  currentSubId: string | null,
): string | null {
  const real = devices.filter(isRealDevice);
  const mainId = mainDeviceId ?? null;

  if (
    currentSubId &&
    currentSubId !== mainId &&
    real.some((d) => d.deviceId === currentSubId)
  ) {
    return currentSubId;
  }

  const liveAlt = real.filter((d) => d.status === 'live' && d.deviceId !== mainId);
  if (liveAlt.length > 0) return liveAlt[0].deviceId;

  const anyAlt = real.find((d) => d.deviceId !== mainId);
  return anyAlt?.deviceId ?? null;
}
