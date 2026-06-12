import { Link, useLocation } from 'react-router-dom';
import { LEGAL_NAV, SITE_LEGAL } from '../../config/siteLegal';
import { readAuthReturnState } from '../../lib/authReturn';
import { LegalAuthReturnBar } from './LegalAuthReturnBar';

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const authReturn = readAuthReturnState(location.state);

  return (
    <>
      <LegalAuthReturnBar />
      <main className="px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold tracking-[0.25em] text-mixer-red">LEGAL</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-mixer-muted">
          Last updated {SITE_LEGAL.lastUpdated} · Effective {SITE_LEGAL.effectiveDate}
        </p>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-6">
          {LEGAL_NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              state={authReturn ?? undefined}
              className="rounded border border-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-mixer-muted hover:border-white/30 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        <article className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-mixer-muted">
          {children}
        </article>

        <footer className="mt-12 border-t border-white/10 pt-6 text-xs text-mixer-muted">
          <p>
            Questions? Contact{' '}
            <a href={`mailto:${SITE_LEGAL.legalEmail}`} className="text-mixer-red hover:underline">
              {SITE_LEGAL.legalEmail}
            </a>
          </p>
          <p className="mt-2">
            {SITE_LEGAL.companyName} · {SITE_LEGAL.address.line2}, {SITE_LEGAL.address.city},{' '}
            {SITE_LEGAL.address.region} {SITE_LEGAL.address.postal}
          </p>
        </footer>
      </div>
    </main>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
