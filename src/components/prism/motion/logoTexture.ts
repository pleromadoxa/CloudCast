import { useEffect, useState } from 'react';
import * as THREE from 'three';

/** Contain-fit box for the logo at scale 1 — matches the prism footprint. */
export const LOGO_MAX_W = 2.6;
export const LOGO_MAX_H = 1.7;

export interface LoadedLogoTexture {
  texture: THREE.Texture;
  aspect: number;
}

/** Loads a logo source into an sRGB texture plus its natural aspect ratio. */
export async function loadLogoTexture(dataUrl: string): Promise<LoadedLogoTexture> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the brand logo.'));
    img.src = dataUrl;
  });
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  return { texture, aspect: w > 0 && h > 0 ? w / h : 1 };
}

/**
 * Reactive logo texture — the loaded entry is keyed to its source so swapping
 * (or clearing) the data URL drops the stale texture immediately, while the
 * effect only ever records async results and disposes on change/unmount.
 */
export function useLogoTexture(dataUrl: string | null | undefined): LoadedLogoTexture | null {
  const [entry, setEntry] = useState<{ key: string; value: LoadedLogoTexture } | null>(null);
  const loaded = dataUrl && entry?.key === dataUrl ? entry.value : null;
  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    let owned: THREE.Texture | null = null;
    void loadLogoTexture(dataUrl)
      .then((next) => {
        if (cancelled) {
          next.texture.dispose();
          return;
        }
        owned = next.texture;
        setEntry({ key: dataUrl, value: next });
      })
      .catch(() => {
        /* Unreadable logo — the procedural mark fallback covers it. */
      });
    return () => {
      cancelled = true;
      owned?.dispose();
    };
  }, [dataUrl]);
  return loaded;
}

/** Contain-fit the logo inside the footprint box for its aspect ratio. */
export function logoPlaneSize(aspect: number): [number, number] {
  const a = Math.max(0.05, aspect);
  const w = a >= LOGO_MAX_W / LOGO_MAX_H ? LOGO_MAX_W : LOGO_MAX_H * a;
  return [w, w / a];
}
