import type { CloudCastProductId } from './products';

export interface PublishedMobileApp {
  id: string;
  product_id: CloudCastProductId;
  platform: 'android' | 'ios';
  version_name: string;
  version_code: number | null;
  description: string | null;
  file_name: string | null;
  size_bytes: number;
  ios_app_store_url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface MobileAppReleaseRow {
  id: string;
  product_id: CloudCastProductId;
  platform: 'android' | 'ios';
  version_name: string;
  version_code: number | null;
  description: string | null;
  storage_path: string | null;
  file_name: string | null;
  size_bytes: number;
  ios_app_store_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
}
