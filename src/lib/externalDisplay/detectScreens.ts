export interface DetectedScreen {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  isPrimary: boolean;
}

function mapApiScreen(screen: WindowManagementScreen, index: number): DetectedScreen {
  return {
    id: `screen-${index}-${screen.left}x${screen.top}`,
    label: screen.label?.trim() || (screen.isPrimary ? 'Primary display' : `Display ${index + 1}`),
    left: screen.availLeft,
    top: screen.availTop,
    width: screen.availWidth,
    height: screen.availHeight,
    isPrimary: screen.isPrimary,
  };
}

function fallbackScreens(): DetectedScreen[] {
  const s = window.screen;
  const left = 'availLeft' in s ? Number(s.availLeft) : 0;
  const top = 'availTop' in s ? Number(s.availTop) : 0;
  const primary: DetectedScreen = {
    id: 'primary',
    label: 'Primary display',
    left,
    top,
    width: s.availWidth,
    height: s.availHeight,
    isPrimary: true,
  };

  const screens = [primary];
  const extended = Boolean(s.isExtended);

  if (extended) {
    screens.push({
      id: 'external-estimate',
      label: 'External display',
      left: primary.left + primary.width,
      top: primary.top,
      width: primary.width,
      height: primary.height,
      isPrimary: false,
    });
  }

  return screens;
}

/** Enumerate connected displays (Window Management API with Mac/Windows fallbacks). */
export async function detectScreens(): Promise<DetectedScreen[]> {
  if (typeof window.getScreenDetails === 'function') {
    try {
      const details = await window.getScreenDetails();
      const mapped = details.screens.map(mapApiScreen);
      if (mapped.length > 0) return mapped;
    } catch {
      /* permission denied or unsupported — fall through */
    }
  }

  return fallbackScreens();
}

export function pickExternalScreen(screens: DetectedScreen[]): DetectedScreen | null {
  const nonPrimary = screens.filter((s) => !s.isPrimary);
  if (nonPrimary.length > 0) return nonPrimary[0];
  return null;
}

export function hasExternalDisplay(screens: DetectedScreen[]): boolean {
  return pickExternalScreen(screens) !== null;
}
