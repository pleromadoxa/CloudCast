import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { productLandingPath } from '../config/productLanding';
import { parseSolutionSlug, SOLUTION_PAGES, solutionPath } from '../config/solutions';
import { RouteSEO } from '../components/seo/RouteSEO';
import { mergeSEO } from '../config/seo';

export function SolutionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const solution = parseSolutionSlug(slug);
  if (!solution) return <Navigate to="/" replace />;

  const seo = mergeSEO(
    {
      title: solution.title,
      description: solution.description,
      path: solutionPath(solution.slug),
      keywords: solution.keywords,
      breadcrumbs: [
        { name: 'Home', path: '/' },
        { name: 'Solutions', path: '/for/churches' },
        { name: solution.title, path: solutionPath(solution.slug) },
      ],
    },
    {},
  );

  return (
    <>
      <RouteSEO overrides={seo} />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#863bff15_0%,_transparent_55%)]" />

        <section className="relative px-6 pb-16 pt-16">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST SOLUTIONS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{solution.headline}</h1>
            <p className="mt-6 text-base leading-relaxed text-mixer-muted">{solution.description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded bg-mixer-red px-6 py-3 text-sm font-bold tracking-wider text-white hover:bg-mixer-red-dim"
              >
                VIEW PRODUCTS <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing?product=universal"
                className="rounded border border-white/20 px-6 py-3 text-sm font-bold tracking-wider hover:border-white/40"
              >
                UNIVERSAL PLANS FROM $59/MO
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-[#0a0a0a] px-6 py-16">
          <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold">Common challenges</h2>
              <ul className="mt-4 space-y-3">
                {solution.painPoints.map((point) => (
                  <li key={point} className="text-sm leading-relaxed text-mixer-muted">{point}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-bold">How CloudCast helps</h2>
              <ul className="mt-4 space-y-3">
                {solution.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-mixer-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-mixer-red" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-xl font-bold">Recommended workflow</h2>
            <ol className="mt-6 space-y-4">
              {solution.workflow.map((step, i) => (
                <li key={step} className="flex gap-4 text-sm text-mixer-muted">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/5 bg-[#0a0a0a] px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-xl font-bold">Products for this use case</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {solution.products.map((name) => {
                const product = CLOUDCAST_PRODUCTS.find((p) => p.name === name);
                if (!product) {
                  return (
                    <span key={name} className="rounded border border-white/10 px-3 py-1.5 text-xs text-mixer-muted">
                      {name}
                    </span>
                  );
                }
                return (
                  <Link
                    key={name}
                    to={productLandingPath(product.id)}
                    className="rounded border border-white/10 px-3 py-1.5 text-xs font-medium text-mixer-muted hover:border-white/30 hover:text-white"
                  >
                    {name}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-lg font-bold">More solutions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {SOLUTION_PAGES.filter((s) => s.slug !== solution.slug).map((s) => (
                <Link
                  key={s.slug}
                  to={solutionPath(s.slug)}
                  className="rounded border border-white/10 px-3 py-1.5 text-xs font-medium capitalize text-mixer-muted hover:border-white/30 hover:text-white"
                >
                  {s.slug.replace('-', ' ')}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
