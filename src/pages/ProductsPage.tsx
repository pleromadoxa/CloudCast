import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { ProductCard, UniversalPlanCard } from '../components/products/ProductCard';
import { SITE_LEGAL } from '../config/siteLegal';

export function ProductsPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST BROADCAST SUITE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Choose your production tool</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-mixer-muted">
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

      <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {CLOUDCAST_PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-5xl">
        <UniversalPlanCard />
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-mixer-muted">
        Already have an account?{' '}
        <Link to="/login" state={{ from: '/hub' }} className="text-mixer-red underline">
          Sign in
        </Link>{' '}
        to open your product dashboards from one place.
      </p>
    </main>
  );
}
