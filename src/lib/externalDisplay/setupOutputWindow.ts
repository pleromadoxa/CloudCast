import type { DetectedScreen } from './detectScreens';

const OUTPUT_WINDOW_NAME = 'cloudcast-external-output';

export function openOutputWindow(): Window | null {
  return window.open(
    '',
    OUTPUT_WINDOW_NAME,
    'popup=yes,menubar=no,toolbar=no,location=no,status=no,scrollbars=no',
  );
}

export function setupOutputWindow(popup: Window): HTMLElement {
  popup.document.open();
  popup.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>CloudCast PGM Output</title></head><body></body></html>',
  );
  popup.document.close();

  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    popup.document.head.appendChild(link.cloneNode(true));
  }
  for (const style of document.querySelectorAll('style')) {
    popup.document.head.appendChild(style.cloneNode(true));
  }

  const inline = popup.document.createElement('style');
  inline.textContent = `
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    #cloudcast-ext-root {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #000;
    }
  `;
  popup.document.head.appendChild(inline);

  const root = popup.document.createElement('div');
  root.id = 'cloudcast-ext-root';
  popup.document.body.appendChild(root);

  return root;
}

export async function placeWindowOnScreen(popup: Window, screen: DetectedScreen): Promise<void> {
  popup.moveTo(screen.left, screen.top);
  popup.resizeTo(screen.width, screen.height);
  popup.focus();

  try {
    const doc = popup.document.documentElement;
    if (doc.requestFullscreen) {
      await doc.requestFullscreen();
    }
  } catch {
    /* fullscreen optional — window is already positioned on the target display */
  }
}
