import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StudioFit, StudioScreenForm, StudioScreenSource } from '../../lib/virtualStudio/types';
import {
  createGraphicCanvas,
  drawStudioGraphic,
  type GraphicCanvasHandle,
} from '../../lib/virtualStudio/graphicCanvas';

/**
 * Bridges a `StudioScreenSource` (live <video>, video/image URL, canvas or
 * procedural broadcast graphic) to a three.js texture, keeping it fresh every
 * frame and disposing it the moment the binding changes.
 */

const loader = new THREE.TextureLoader();

function applyColor(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function videoTexture(video: HTMLVideoElement): THREE.VideoTexture {
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export interface StudioTextureResult {
  texture: THREE.Texture | null;
  /** Aspect ratio of the source when known (screens letterbox to it). */
  aspect: number | null;
}

function useManagedVideo(url: string, loop: boolean): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [loadedFor, setLoadedFor] = useState('');

  // Render-phase reset: a stale element must never keep painting while a new
  // URL buffers (React's sanctioned "derived state" adjustment).
  if (url && loadedFor !== url) {
    setLoadedFor(url);
    setVideo(null);
  }

  useEffect(() => {
    if (!url) return;
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous';
    el.muted = true;
    el.loop = loop;
    el.playsInline = true;
    el.preload = 'auto';
    el.src = url;
    const onReady = () => setVideo(el);
    el.addEventListener('loadeddata', onReady);
    void el.play().catch(() => undefined);
    return () => {
      el.removeEventListener('loadeddata', onReady);
      el.pause();
      el.removeAttribute('src');
      el.load();
    };
  }, [url, loop]);

  return url ? video : null;
}

export function useStudioTexture(
  source: StudioScreenSource | undefined,
  fit: StudioFit = 'cover',
  form: StudioScreenForm = 'monitor',
  /** Physical surface aspect (width/height) — keeps graphics undistorted. */
  surfaceAspect?: number,
): StudioTextureResult {
  // Destructure into simple, stable values so every memo gets a plain dep.
  const imageUrl = source?.kind === 'image-url' ? source.url : '';
  const videoUrl = source?.kind === 'video-url' ? source.url : '';
  const videoLoop = source?.kind === 'video-url' ? source.loop ?? true : true;
  const liveVideo = source?.kind === 'live-video' ? source.video ?? null : null;
  const canvasSource = source?.kind === 'canvas' ? source.canvas ?? null : null;
  const graphicContent = source?.kind === 'graphic' ? source.content : null;

  // --- image ---------------------------------------------------------------
  const imageTexture = useMemo(() => {
    if (!imageUrl) return null;
    const tex = loader.load(imageUrl, applyColor, undefined, () => undefined);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.userData.fit = fit;
    return tex;
  }, [imageUrl, fit]);

  useEffect(() => () => imageTexture?.dispose(), [imageTexture]);

  // --- managed video (video-url) -------------------------------------------
  const managedVideo = useManagedVideo(videoUrl, videoLoop);

  const managedVideoTexture = useMemo(() => {
    if (!videoUrl || !managedVideo) return null;
    return videoTexture(managedVideo);
  }, [videoUrl, managedVideo]);

  useEffect(() => () => managedVideoTexture?.dispose(), [managedVideoTexture]);

  // --- caller-owned live video --------------------------------------------
  const liveTexture = useMemo(() => (liveVideo ? videoTexture(liveVideo) : null), [liveVideo]);
  useEffect(() => () => liveTexture?.dispose(), [liveTexture]);

  // --- canvas --------------------------------------------------------------
  const canvasTexture = useMemo(
    () => (canvasSource ? applyColor(new THREE.CanvasTexture(canvasSource)) : null),
    [canvasSource],
  );
  useEffect(() => () => canvasTexture?.dispose(), [canvasTexture]);

  // --- procedural broadcast graphic ---------------------------------------
  const graphic = useMemo(() => {
    if (!graphicContent) return null;
    const handle: GraphicCanvasHandle = createGraphicCanvas(form, surfaceAspect);
    drawStudioGraphic(handle, graphicContent);
    const tex = applyColor(new THREE.CanvasTexture(handle.canvas));
    return { handle, tex };
  }, [graphicContent, form, surfaceAspect]);

  useEffect(() => () => graphic?.tex.dispose(), [graphic]);

  // --- live refresh --------------------------------------------------------
  const active =
    liveTexture ?? managedVideoTexture ?? canvasTexture ?? graphic?.tex ?? imageTexture ?? null;

  // Animated graphics (news crawls, live clocks) redraw at ~24 fps; static
  // graphics render once on content change like a printed plate.
  const lastGraphicDrawRef = useRef(0);

  // Imperative per-frame texture refresh is the point of this hook — the
  // textures are mutable GPU surfaces, not React state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((state) => {
    if (liveTexture || managedVideoTexture || canvasTexture) {
      const tex = liveTexture ?? managedVideoTexture ?? canvasTexture;
      // Textures are mutable by design; needsUpdate re-uploads the frame.
      // eslint-disable-next-line react-hooks/immutability
      if (tex) tex.needsUpdate = true;
      return;
    }
    if (graphic && graphicContent?.animated) {
      const t = state.clock.elapsedTime;
      if (t - lastGraphicDrawRef.current < 1 / 24) return;
      lastGraphicDrawRef.current = t;
      drawStudioGraphic(graphic.handle, graphicContent, t);
      // eslint-disable-next-line react-hooks/immutability
      graphic.tex.needsUpdate = true;
    }
  });

  const aspect = useMemo(() => {
    if (!active) return null;
    const img = active.image as unknown;
    if (!img || typeof img !== 'object') return null;
    const rec = img as Record<string, unknown>;
    if ('videoWidth' in rec) {
      const video = img as HTMLVideoElement;
      return video.videoWidth > 0 ? video.videoWidth / video.videoHeight : null;
    }
    if ('naturalWidth' in rec) {
      const image = img as HTMLImageElement;
      return image.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : null;
    }
    if ('width' in rec && 'height' in rec) {
      const c = img as { width: number; height: number };
      return c.height > 0 ? c.width / c.height : null;
    }
    return null;
  }, [active]);

  return { texture: active, aspect };
}
