import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { ProductCard, UniversalPlanCard } from '../components/products/ProductCard';
import { SITE_LEGAL } from '../config/siteLegal';

export function ProductsPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e11d4812_0%,_transparent_55%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST BROADCAST SUITE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Choose your production tool
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mixer-muted sm:text-base">
            {SITE_LEGAL.brandLine} is the platform. Each product is a dedicated production console — subscribe
            individually or unlock everything with CloudCast Universal.
          </p>
          <Link
            to="/products/guide"
            className="mt-6 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-mixer-red hover:text-white"
          >
            READ THE FULL PRODUCT GUIDE <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CLOUDCAST_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} show3D />
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <UniversalPlanCard />
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-mixer-muted">
          Already have an account?{' '}
          <Link to="/login" state={{ from: '/hub' }} className="text-mixer-red underline">
            Sign in
          </Link>{' '}
          to open your product dashboards from one place.
        </p>
      </div>
    </main>
  );
}
