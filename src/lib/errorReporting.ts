import { getSupabase, isSupabaseConfigured } from './supabase';

interface ReportErrorInput {
  message: string;
  stack?: string | null;
  severity?: 'warn' | 'error' | 'fatal';
  source?: string;
  sessionId?: string | null;
  context?: Record<string, unknown>;
}

const recentFingerprints = new Set<string>();
const MAX_RECENT = 40;

function fingerprint(input: ReportErrorInput): string {
  return `${input.source ?? 'client'}:${input.message}`.slice(0, 200);
}

/** Fire-and-forget client error reporting to Supabase. */
export function reportClientError(input: ReportErrorInput): void {
  if (!isSupabaseConfigured()) return;

  const fp = fingerprint(input);
  if (recentFingerprints.has(fp)) return;
  recentFingerprints.add(fp);
  if (recentFingerprints.size > MAX_RECENT) {
    const first = recentFingerprints.values().next().value;
    if (first) recentFingerprints.delete(first);
  }

  void getSupabase()
    .rpc('log_client_error', {
      p_message: input.message,
      p_stack: input.stack ?? null,
      p_context: input.context ?? {},
      p_severity: input.severity ?? 'error',
      p_source: input.source ?? 'client',
      p_session_id: input.sessionId ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('[CloudCast] Error report failed:', error.message);
    });
}

export function installGlobalErrorReporting(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.message || 'Unhandled error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: 'window.error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandledrejection',
    });
  });
}
