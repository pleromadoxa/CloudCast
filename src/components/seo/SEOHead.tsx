import { useEffect, useRef } from 'react';
import {
  collectJsonLd,
  DEFAULT_OG_IMAGE,
  FAVICON_PATH,
  resolveCanonicalUrl,
  resolvePageTitle,
  SITE_BRAND,
  SITE_NAME,
  SITE_URL,
  type PageSEOConfig,
} from '../../config/seo';

const MANAGED_ATTR = 'data-cloudcast-seo';

interface ManagedElement {
  el: HTMLElement;
  created: boolean;
}

function setMeta(name: string, content: string, property = false): ManagedElement {
  const attr = property ? 'property' : 'name';
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${name}"][${MANAGED_ATTR}]`,
  );
  const created = !el;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    el.setAttribute(MANAGED_ATTR, '');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return { el, created };
}

function setLink(rel: string, href: string): ManagedElement {
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"][${MANAGED_ATTR}]`,
  );
  const created = !el;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute(MANAGED_ATTR, '');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return { el, created };
}

/** Keep the CloudCast tab icon on every SPA route (Display, Prism, etc.). */
function syncFavicon(): void {
  for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
    link.type = 'image/png';
    link.href = FAVICON_PATH;
  }

  let touch = document.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!touch) {
    touch = document.createElement('link');
    touch.rel = 'apple-touch-icon';
    document.head.appendChild(touch);
  }
  touch.href = FAVICON_PATH;
}

function setJsonLd(id: string, data: Record<string, unknown>): ManagedElement {
  let el = document.head.querySelector<HTMLScriptElement>(
    `script[type="application/ld+json"]#${id}`,
  );
  const created = !el;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    el.setAttribute(MANAGED_ATTR, '');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
  return { el, created };
}

function applySEO(config: PageSEOConfig): () => void {
  const managed: ManagedElement[] = [];
  const title = resolvePageTitle(config);
  const canonical = resolveCanonicalUrl(config.path);
  const description = config.description;
  const robots = config.robots ?? 'index, follow';
  const ogType = config.ogType ?? 'website';
  const ogImage = config.ogImage ?? DEFAULT_OG_IMAGE;
  const keywords = config.keywords?.join(', ');

  document.title = title;
  syncFavicon();

  managed.push(setMeta('description', description));
  managed.push(setMeta('robots', robots));
  managed.push(setMeta('googlebot', robots));
  if (keywords) managed.push(setMeta('keywords', keywords));

  managed.push(setMeta('author', SITE_BRAND));
  managed.push(setMeta('application-name', SITE_NAME));

  // Open Graph
  managed.push(setMeta('og:title', title, true));
  managed.push(setMeta('og:description', description, true));
  managed.push(setMeta('og:type', ogType, true));
  managed.push(setMeta('og:url', canonical, true));
  managed.push(setMeta('og:site_name', SITE_BRAND, true));
  managed.push(setMeta('og:locale', 'en_US', true));
  managed.push(setMeta('og:image', ogImage, true));
  managed.push(setMeta('og:image:alt', `${SITE_BRAND} — ${config.title}`, true));
  managed.push(setMeta('og:image:width', '1200', true));
  managed.push(setMeta('og:image:height', '630', true));

  // Twitter Card
  managed.push(setMeta('twitter:card', 'summary_large_image'));
  managed.push(setMeta('twitter:title', title));
  managed.push(setMeta('twitter:description', description));
  managed.push(setMeta('twitter:image', ogImage));
  managed.push(setMeta('twitter:image:alt', `${SITE_BRAND} — ${config.title}`));

  managed.push(setLink('canonical', canonical));

  // JSON-LD
  const schemas = collectJsonLd(config);
  schemas.forEach((schema, index) => {
    managed.push(setJsonLd(`cloudcast-jsonld-${index}`, schema));
  });

  return () => {
    for (const { el, created } of managed) {
      if (created) el.remove();
    }
  };
}

/**
 * Renders nothing — synchronously updates document head for SEO, Open Graph,
 * Twitter Cards, canonical URLs, and JSON-LD structured data.
 */
export function SEOHead({ config }: { config: PageSEOConfig }) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = applySEO(config);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [config]);

  return null;
}

/** Convenience hook for pages that need custom SEO overrides. */
export function usePageSEO(config: PageSEOConfig): void {
  const serialized = JSON.stringify(config);

  useEffect(() => {
    const parsed = JSON.parse(serialized) as PageSEOConfig;
    return applySEO(parsed);
  }, [serialized]);
}

export { SITE_URL };
