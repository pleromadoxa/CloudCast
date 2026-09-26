import { CLOUDCAST_PRODUCTS } from '../config/products';
import type { CloudCastProductId } from '../types/products';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type PlatformProductServiceMap = Record<CloudCastProductId, boolean>;

const DEFAULT_MAP: PlatformProductServiceMap = Object.fromEntries(
  CLOUDCAST_PRODUCTS.map((p) => [p.id, true]),
) as PlatformProductServiceMap;

/** Module cache so pure entitlement helpers can read the latest flags. */
let cachedMap: PlatformProductServiceMap = { ...DEFAULT_MAP };
let loaded = false;

export function defaultPlatformProductServiceMap(): PlatformProductServiceMap {
  return { ...DEFAULT_MAP };
}

export function getPlatformProductServiceMap(): PlatformProductServiceMap {
  return cachedMap;
}

export function setPlatformProductServiceMap(map: Partial<PlatformProductServiceMap> | null | undefined): void {
  cachedMap = { ...DEFAULT_MAP, ...(map ?? {}) };
  loaded = true;
}

export function isPlatformProductServicesLoaded(): boolean {
  return loaded;
}

/** Fail open until the first successful fetch so entitled users are not briefly blocked. */
export function isPlatformProductEnabled(product: CloudCastProductId): boolean {
  return cachedMap[product] !== false;
}

export function normalizePlatformProductServiceMap(
  rows: Array<{ product_id: string; is_enabled: boolean }> | null | undefined,
): PlatformProductServiceMap {
  const next = defaultPlatformProductServiceMap();
  for (const row of rows ?? []) {
    if (row.product_id in next) {
      next[row.product_id as CloudCastProductId] = Boolean(row.is_enabled);
    }
  }
  return next;
}

export async function fetchPlatformProductServices(): Promise<PlatformProductServiceMap> {
  if (!isSupabaseConfigured()) {
    const fallback = defaultPlatformProductServiceMap();
    setPlatformProductServiceMap(fallback);
    return fallback;
  }
  const { data, error } = await getSupabase().rpc('get_platform_product_services');
  if (error) throw new Error(error.message);
  const map = normalizePlatformProductServiceMap(
    (data ?? []) as Array<{ product_id: string; is_enabled: boolean }>,
  );
  setPlatformProductServiceMap(map);
  return map;
}
