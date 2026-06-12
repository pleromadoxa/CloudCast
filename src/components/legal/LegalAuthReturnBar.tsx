import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { authReturnLabel, authReturnPath, readAuthReturnState } from '../../lib/authReturn';

/** Sticky bar when a legal page was opened from sign-in / sign-up. */
export function LegalAuthReturnBar() {
  const location = useLocation();
  const authReturn = readAuthReturnState(location.state);
  if (!authReturn) return null;

  const back = authReturnPath(authReturn);

  return (
    <div className="sticky top-[52px] z-40 border-b border-mixer-red/30 bg-[#0a0a0a]/95 backdrop-blur-md sm:top-[56px]">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
        <Link
          to={back.pathname}
          state={back.state}
          className="inline-flex items-center gap-2 rounded bg-mixer-red px-4 py-2 text-xs font-bold tracking-wider text-white transition-colors hover:bg-mixer-red-dim"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {authReturnLabel(authReturn)}
        </Link>
        <span className="hidden text-[10px] text-mixer-muted sm:inline">
          You can finish creating your account when you&apos;re done reading.
        </span>
      </div>
    </div>
  );
}
