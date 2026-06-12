/** Window Management API — Chrome/Edge on macOS and Windows */
interface WindowManagementScreenDetails {
  screens: WindowManagementScreen[];
  currentScreen: WindowManagementScreen;
  onscreenschange: ((this: WindowManagementScreenDetails, ev: Event) => void) | null;
  addEventListener(type: 'screenschange', listener: () => void): void;
  removeEventListener(type: 'screenschange', listener: () => void): void;
}

interface WindowManagementScreen {
  availHeight: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  colorDepth: number;
  height: number;
  isExtended: boolean;
  isInternal: boolean;
  isPrimary: boolean;
  label: string;
  left: number;
  pixelDepth: number;
  top: number;
  width: number;
}

interface Window {
  getScreenDetails?: () => Promise<WindowManagementScreenDetails>;
}

interface WindowManagement {
  getScreenDetails(): Promise<WindowManagementScreenDetails>;
}

interface Navigator {
  windowManagement?: WindowManagement;
}

interface Screen {
  isExtended?: boolean;
}
