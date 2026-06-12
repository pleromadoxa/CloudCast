import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import type { PublishedMobileApp } from '../types/mobileApps';

type MobileR2Action = 'mobile-presign-download';

async function invokeMobileR2<T>(action: MobileR2Action, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.cloudStorageUnavailable);
  }

  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to download mobile apps.');
  }

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const res = await fetch(`${base}/functions/v1/cloudcast-r2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ action, ...body }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(payload.error ?? `${USER_MSG.cloudStorageRequestFailed} (${res.status})`));
  }
  return payload as T;
}

function mapPublishedApp(row: Record<string, unknown>): PublishedMobileApp {
  return {
    id: String(row.id),
    product_id: row.product_id as PublishedMobileApp['product_id'],
    platform: (row.platform as PublishedMobileApp['platform']) ?? 'android',
    version_name: String(row.version_name),
    version_code: row.version_code != null ? Number(row.version_code) : null,
    description: row.description ? String(row.description) : null,
    file_name: row.file_name ? String(row.file_name) : null,
    size_bytes: Number(row.size_bytes ?? 0),
    ios_app_store_url: row.ios_app_store_url ? String(row.ios_app_store_url) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    created_at: String(row.created_at),
  };
}

export async function fetchPublishedMobileApps(): Promise<PublishedMobileApp[]> {
  const { data, error } = await getSupabase().rpc('list_published_mobile_apps');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapPublishedApp);
}

export async function getMobileAppDownloadUrl(releaseId: string): Promise<string> {
  const { url } = await invokeMobileR2<{ url: string }>('mobile-presign-download', {
    release_id: releaseId,
  });
  return url;
}
