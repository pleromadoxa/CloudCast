import { Link } from 'react-router-dom';
import { WHY_CLOUDCAST_POINTS } from '../../config/productGuideContent';

export function HomeFaq() {
  return (
    <section className="border-t border-white/5 bg-[#0a0a0a] px-6 py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Why CloudCast?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-mixer-muted">
          Professional broadcast tools in your browser — no hardware rack, no install, no OB truck.
        </p>
        <dl className="mt-10 space-y-6">
          {WHY_CLOUDCAST_POINTS.map(({ title, description }) => (
            <div key={title} className="rounded-lg border border-white/10 bg-mixer-panel p-6">
              <dt className="font-bold text-white">{title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-mixer-muted">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-center text-sm text-mixer-muted">
          <Link to="/products/guide" className="font-bold text-mixer-red hover:text-white">
            Read the full product guide →
          </Link>
        </p>
      </div>
    </section>
  );
}
