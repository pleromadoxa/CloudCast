declare const __APP_BUILD_ID__: string;

const BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

export function currentAppBuildId(): string {
  return BUILD_ID;
}

/** Detect a newer dashboard deploy (Chrome may serve cached index.html). */
export async function fetchLatestAppBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/name="cloudcast-build"\s+content="([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isNewerBuildAvailable(latest: string | null): boolean {
  if (!latest || latest === 'dev') return false;
  return latest !== BUILD_ID;
}
