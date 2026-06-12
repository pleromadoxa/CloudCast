import { useSupabaseHeartbeat } from '../../hooks/useSupabaseHeartbeat';

/** Invisible keep-alive — mounts once at app root. */
export function SupabaseHeartbeat() {
  useSupabaseHeartbeat(true);
  return null;
}
