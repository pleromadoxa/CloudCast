import { useRef, useState } from 'react';
import { Check, Loader2, Smartphone, Trash2, Upload } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../../config/products';
import {
  adminDeleteMobileAppRelease,
  adminPublishMobileAppRelease,
  adminUnpublishMobileAppRelease,
  adminUploadMobileAppRelease,
} from '../../lib/adminService';
import { formatBytes } from '../../lib/formatBytes';
import type { MobileAppReleaseRow } from '../../types/mobileApps';
import type { CloudCastProductId } from '../../types/products';
import { AdminSection } from './AdminShared';
import { cn } from '../../lib/utils';

const PRODUCT_ACCENTS: Record<CloudCastProductId, string> = {
  video_mixer: 'border-mixer-red/30 bg-mixer-red/5',
  audio_mixer: 'border-blue-500/30 bg-blue-500/5',
  symphony_studio: 'border-purple-500/30 bg-purple-500/5',
  instant_replay: 'border-emerald-500/30 bg-emerald-500/5',
};

export function AdminMobileAppsPanel({
  releases,
  onRefresh,
}: {
  releases: MobileAppReleaseRow[];
  onRefresh: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState<CloudCastProductId>('video_mixer');
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [description, setDescription] = useState('');
  const [publishOnUpload, setPublishOnUpload] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedByProduct = CLOUDCAST_PRODUCTS.map((product) => ({
    product,
    release: releases.find((r) => r.product_id === product.id && r.is_published) ?? null,
  }));

  const handleUpload = async () => {
    if (!versionName.trim() || !selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.apk')) {
      setError('Please select an Android APK file.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await adminUploadMobileAppRelease({
        productId,
        versionName: versionName.trim(),
        versionCode: versionCode ? Number(versionCode) : null,
        description: description.trim() || null,
        file: selectedFile,
        publish: publishOnUpload,
      });
      setVersionName('');
      setVersionCode('');
      setDescription('');
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setActionId(id);
    setError(null);
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {publishedByProduct.map(({ product, release }) => (
          <div
            key={product.id}
            className={cn('rounded-lg border p-4', PRODUCT_ACCENTS[product.id])}
          >
            <p className="text-sm font-bold">{product.shortName} Mobile</p>
            {release ? (
              <>
                <p className="mt-1 text-xs text-mixer-muted">v{release.version_name} live</p>
                {release.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-white/70">{release.description}</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-mixer-muted">No published APK</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <AdminSection
          title="Upload APK"
          description="Publish Android builds for Video Mixer, Audio Mixer, or Symphony companion apps."
        >
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="text-mixer-muted">Product</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value as CloudCastProductId)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              >
                {CLOUDCAST_PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-mixer-muted">Version name</span>
                <input
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="1.2.0"
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
                />
              </label>
              <label className="block">
                <span className="text-mixer-muted">Version code (optional)</span>
                <input
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  placeholder="120"
                  inputMode="numeric"
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-mixer-muted">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What's new in this build — shown on the user dashboard."
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
            </label>
            <label className="block">
              <span className="text-mixer-muted">APK file</span>
              <input
                ref={fileRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider"
              />
              {selectedFile && (
                <p className="mt-1 text-[10px] text-mixer-muted">
                  {selectedFile.name} · {formatBytes(selectedFile.size)}
                </p>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishOnUpload}
                onChange={(e) => setPublishOnUpload(e.target.checked)}
                className="rounded border-white/20"
              />
              Publish immediately (replaces current live build for this product)
            </label>
            {error && <p className="text-mixer-red">{error}</p>}
            <button
              type="button"
              disabled={uploading || !versionName.trim() || !selectedFile}
              onClick={() => { void handleUpload(); }}
              className="inline-flex items-center gap-2 rounded bg-mixer-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload APK
            </button>
          </div>
        </AdminSection>

        <AdminSection title="All releases" description="Manage published builds and version history.">
          <div className="space-y-2">
            {releases.length === 0 ? (
              <p className="text-sm text-mixer-muted">No mobile app releases yet.</p>
            ) : (
              releases.map((release) => {
                const product = CLOUDCAST_PRODUCTS.find((p) => p.id === release.product_id)!;
                const busy = actionId === release.id;
                return (
                  <div
                    key={release.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-3.5 w-3.5 text-mixer-muted" />
                          <span className="text-sm font-bold">{product.shortName}</span>
                          <span className="text-xs text-mixer-muted">v{release.version_name}</span>
                          {release.is_published && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                              Live
                            </span>
                          )}
                        </div>
                        {release.description && (
                          <p className="mt-1 text-xs text-white/70">{release.description}</p>
                        )}
                        <p className="mt-1 text-[10px] text-mixer-muted">
                          {release.file_name} · {formatBytes(release.size_bytes)}
                          {release.created_by_email ? ` · ${release.created_by_email}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {!release.is_published && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { void runAction(release.id, () => adminPublishMobileAppRelease(release.id)); }}
                            className="inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Publish
                          </button>
                        )}
                        {release.is_published && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { void runAction(release.id, () => adminUnpublishMobileAppRelease(release.id)); }}
                            className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 disabled:opacity-50"
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm('Delete this release and remove the APK from storage?')) return;
                            void runAction(release.id, () => adminDeleteMobileAppRelease(release.id));
                          }}
                          className="inline-flex items-center gap-1 rounded border border-mixer-red/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mixer-red hover:bg-mixer-red/10 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
