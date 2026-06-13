import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { CLOUDCAST_PRODUCTS, parseProductId } from '../../config/products';
import { WHY_CLOUDCAST_POINTS } from '../../config/productGuideContent';
import { getSEOForPath, mergeSEO, type PageSEOConfig } from '../../config/seo';
import { SEOHead } from './SEOHead';

function buildFaqSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: WHY_CLOUDCAST_POINTS.map(({ title, description }) => ({
      '@type': 'Question',
      name: title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: description,
      },
    })),
  };
}

function pricingOverrides(search: string): Partial<PageSEOConfig> | undefined {
  const productParam = new URLSearchParams(search).get('product');
  if (!productParam) return undefined;

  const productId = parseProductId(productParam);
  if (!productId) return undefined;

  const product = CLOUDCAST_PRODUCTS.find((p) => p.id === productId);
  if (!product) return undefined;

  return {
    title: `${product.name} Pricing — Free, Pro & Pro Master Plans`,
    description: `Pricing for ${product.name}: ${product.description} Plans from $0/month with Regal Mesh, or upgrade to Pro and Pro Master for Regal Cloud HD+ streaming.`,
    path: `/pricing?product=${productId}`,
    keywords: [
      `${product.name} pricing`,
      `${product.shortName} mixer pricing`,
      'CloudCast subscription',
    ],
  };
}

/**
 * Route-aware SEO for marketing and app pages.
 * Pass `overrides` to customize title, description, or structured data per page.
 */
export function RouteSEO({ overrides }: { overrides?: Partial<PageSEOConfig> }) {
  const { pathname, search } = useLocation();

  const config = useMemo(() => {
    let base = getSEOForPath(pathname);

    if (pathname === '/products/guide') {
      base = mergeSEO(base, {
        jsonLd: [...(base.jsonLd ?? []), buildFaqSchema()],
      });
    }

    const dynamic = pathname === '/pricing' ? pricingOverrides(search) : undefined;
    if (dynamic) base = mergeSEO(base, dynamic);
    if (overrides) base = mergeSEO(base, overrides);

    return base;
  }, [pathname, search, overrides]);

  return <SEOHead config={config} />;
}
