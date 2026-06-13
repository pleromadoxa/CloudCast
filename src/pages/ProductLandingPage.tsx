import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { getProductGuideSection, parseProductSlug, productLandingPath, productPricingPath, PRODUCT_SEO_KEYWORDS } from '../config/productLanding';
import { RouteSEO } from '../components/seo/RouteSEO';
import { mergeSEO } from '../config/seo';

export function ProductLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const productId = parseProductSlug(slug);
  if (!productId) return <Navigate to="/products" replace />;

  const product = CLOUDCAST_PRODUCTS.find((p) => p.id === productId)!;
  const guide = getProductGuideSection(productId);
  const pricingPath = productPricingPath(productId);

  const seo = mergeSEO(
    {
      title: `${product.name} — ${product.tagline}`,
      description: `${product.description} Start free with Regal Mesh or upgrade to Pro for Regal Cloud HD+ streaming. ${guide?.overview.slice(0, 120) ?? ''}`,
      path: productLandingPath(productId),
      keywords: PRODUCT_SEO_KEYWORDS[productId],
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Products', path: '/products' },
        { name: product.name, path: productLandingPath(productId) },
      ],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: product.name,
          description: product.description,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Web Browser',
          url: `https://cloudcast.live${productLandingPath(productId)}`,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            description: 'Free tier available',
          },
        },
      ],
    },
    {},
  );

  return (
    <>
      <RouteSEO overrides={seo} />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e11d4812_0%,_transparent_55%)]" />

        <section className="relative px-6 pb-16 pt-16">
          <div className="mx-auto max-w-4xl">
            <nav className="text-xs text-mixer-muted">
              <Link to="/" className="hover:text-white">Home</Link>
              <span className="mx-2">/</span>
              <Link to="/products" className="hover:text-white">Products</Link>
              <span className="mx-2">/</span>
              <span className="text-white">{product.shortName}</span>
            </nav>

            <p className="mt-6 text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST PRODUCT</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{product.name}</h1>
            <p className="mt-2 text-lg text-mixer-muted">{product.tagline}</p>
            <p className="mt-6 text-base leading-relaxed text-mixer-muted">{product.description}</p>

            {guide && (
              <p className="mt-4 text-sm leading-relaxed text-mixer-muted">{guide.overview}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                state={{ from: product.dashboardPath }}
                className="inline-flex items-center gap-2 rounded bg-mixer-red px-6 py-3 text-sm font-bold tracking-wider text-white hover:bg-mixer-red-dim"
              >
                START FREE <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={pricingPath}
                className="rounded border border-white/20 px-6 py-3 text-sm font-bold tracking-wider hover:border-white/40"
              >
                VIEW PRICING
              </Link>
              <Link
                to="/products/guide"
                className="rounded border border-white/20 px-6 py-3 text-sm font-bold tracking-wider hover:border-white/40"
              >
                FULL GUIDE
              </Link>
            </div>
          </div>
        </section>

        {guide && (
          <>
            <section className="border-y border-white/5 bg-[#0a0a0a] px-6 py-16">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-2xl font-bold">Why teams choose {product.shortName}</h2>
                <ul className="mt-8 space-y-6">
                  {guide.problems.map(({ title, description }) => (
                    <li key={title} className="rounded-lg border border-white/10 bg-mixer-panel p-6">
                      <h3 className="font-bold text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-mixer-muted">{description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="px-6 py-16">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-2xl font-bold">Key capabilities</h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {guide.keyCapabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-2 text-sm text-mixer-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-mixer-red" />
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="border-t border-white/5 bg-[#0a0a0a] px-6 py-16">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-2xl font-bold">How to use {product.name}</h2>
                <ol className="mt-8 space-y-6">
                  {guide.howToUse.map(({ step, title, description }) => (
                    <li key={step} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mixer-red/20 text-sm font-bold text-mixer-red">
                        {step}
                      </span>
                      <div>
                        <h3 className="font-bold">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-mixer-muted">{description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section className="px-6 py-16">
              <div className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-mixer-panel p-8">
                <h2 className="text-xl font-bold">{guide.liveScenario.title}</h2>
                <p className="mt-2 text-sm text-mixer-muted">{guide.liveScenario.context}</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-mixer-muted">
                  {guide.liveScenario.workflow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-4 text-sm font-medium text-white">{guide.liveScenario.outcome}</p>
                <p className="mt-4 text-sm text-mixer-muted">
                  {guide.costEffectiveness.summary}
                </p>
                <Link
                  to={pricingPath}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold tracking-wider text-mixer-red hover:text-white"
                >
                  SEE PLANS — {guide.costEffectiveness.monthlyRange} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </>
        )}

        <section className="border-t border-white/5 px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-lg font-bold">Explore other CloudCast products</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {CLOUDCAST_PRODUCTS.filter((p) => p.id !== productId).map((p) => (
                <Link
                  key={p.id}
                  to={productLandingPath(p.id)}
                  className="rounded border border-white/10 px-3 py-1.5 text-xs font-medium text-mixer-muted hover:border-white/30 hover:text-white"
                >
                  {p.shortName}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
