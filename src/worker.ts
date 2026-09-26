interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetsFetcher;
}

function cacheHeadersForPath(pathname: string, contentType: string | null): HeadersInit {
  if (pathname.startsWith('/assets/')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }

  const isHtml =
    pathname === '/' ||
    pathname.endsWith('.html') ||
    pathname.endsWith('/') ||
    (contentType?.includes('text/html') ?? false);

  if (isHtml) {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  }

  return { 'Cache-Control': 'public, max-age=3600, must-revalidate' };
}

function withCacheHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const cache = cacheHeadersForPath(url.pathname, headers.get('content-type'));
  for (const [key, value] of Object.entries(cache)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    return withCacheHeaders(request, response);
  },
};
