import { useEffect, useRef } from 'react';
import { useMediaFeedOptional } from '../../context/MediaFeedContext';
import { ensureAudioOutputReady, registerDashboardAudioContext } from '../../lib/audioOutput';
import { AUDIO_MONITOR_FADE_SEC } from '../../lib/audioFade';

/**
 * Recover Media Shot audio without tearing the graph down on mute.
 * On-screen <video> elements stay muted (visual only); a Web Audio
 * MediaElementSource feeds preview/program MediaStreams. Mute ramps GainNodes
 * so live ↔ preview mute/unmute stays seamless.
 */

let bridgeContext: AudioContext | null = null;

function getBridgeContext(): AudioContext {
  if (!bridgeContext || bridgeContext.state === 'closed') {
    bridgeContext = new AudioContext();
    registerDashboardAudioContext(bridgeContext);
  }
  return bridgeContext;
}

function setGainTarget(gain: GainNode, value: number, fadeSec = AUDIO_MONITOR_FADE_SEC) {
  const ctx = gain.context;
  const now = ctx.currentTime;
  const next = Math.min(1, Math.max(0, value));
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(next, now + fadeSec);
  } catch {
    gain.gain.value = next;
  }
}

interface BusGraph {
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  previewGain: GainNode;
  programGain: GainNode;
  previewDest: MediaStreamAudioDestinationNode;
  programDest: MediaStreamAudioDestinationNode;
  playUrl: string;
}

function createBusGraph(playUrl: string, loop = true): BusGraph {
  const ctx = getBridgeContext();
  const el = new Audio();
  el.preload = 'auto';
  if (!playUrl.startsWith('blob:')) {
    el.crossOrigin = 'anonymous';
  }
  el.loop = loop;
  el.src = playUrl;
  try {
    el.load();
  } catch {
    /* ignore */
  }

  const source = ctx.createMediaElementSource(el);
  const previewGain = ctx.createGain();
  const programGain = ctx.createGain();
  previewGain.gain.value = 0;
  programGain.gain.value = 0;
  const previewDest = ctx.createMediaStreamDestination();
  const programDest = ctx.createMediaStreamDestination();

  source.connect(previewGain);
  source.connect(programGain);
  previewGain.connect(previewDest);
  programGain.connect(programDest);

  return { el, source, previewGain, programGain, previewDest, programDest, playUrl };
}

function disposeBusGraph(graph: BusGraph | null) {
  if (!graph) return;
  try {
    graph.el.pause();
    graph.el.removeAttribute('src');
    graph.el.load();
  } catch {
    /* ignore */
  }
  try {
    graph.source.disconnect();
  } catch {
    /* ignore */
  }
  try {
    graph.previewGain.disconnect();
    graph.programGain.disconnect();
  } catch {
    /* ignore */
  }
}

function syncElementPlay(el: HTMLAudioElement | null | undefined, playing: boolean) {
  if (!el) return;
  if (playing) void el.play().catch(() => undefined);
  else el.pause();
}

/** Recovers audible preview/program audio for the Media virtual input. */
export function MediaFeedAudioBridge() {
  const mediaFeed = useMediaFeedOptional();
  /** Shared graph when preview + program use the same clip. */
  const sharedRef = useRef<BusGraph | null>(null);
  /** Separate graphs when PST and PGM play different clips. */
  const previewOnlyRef = useRef<BusGraph | null>(null);
  const programOnlyRef = useRef<BusGraph | null>(null);

  const pstMedia = mediaFeed?.pstMedia ?? null;
  const livePgmMedia = mediaFeed?.livePgmMedia ?? null;
  const pgmMedia = mediaFeed?.pgmMedia ?? null;
  const transportPlaying = mediaFeed?.transport.playing ?? false;
  const previewAllowed = mediaFeed?.previewAudioAllowed ?? false;
  const programAllowed = mediaFeed?.programAudioAllowed ?? false;
  const setPreviewStream = mediaFeed?.setPreviewStream;
  const setProgramStream = mediaFeed?.setProgramStream;

  const previewUrl = pstMedia?.kind === 'video' ? pstMedia.playUrl || null : null;
  const previewLoop = pstMedia?.kind === 'video' ? (pstMedia.loop ?? true) : true;
  const programLoop =
    livePgmMedia?.kind === 'video'
      ? (livePgmMedia.loop ?? true)
      : pgmMedia?.kind === 'video'
        ? (pgmMedia.loop ?? true)
        : true;
  const programUrl =
    (livePgmMedia?.kind === 'video' ? livePgmMedia.playUrl || null : null) ??
    (mediaFeed?.pgmIsMedia && pgmMedia?.kind === 'video' ? pgmMedia.playUrl || null : null);

  const sameClip = Boolean(previewUrl && programUrl && previewUrl === programUrl);

  useEffect(() => {
    void ensureAudioOutputReady();
    const ctx = getBridgeContext();
    void ctx.resume().catch(() => undefined);

    let previewStream: MediaStream | null = null;
    let programStream: MediaStream | null = null;

    if (!previewUrl && !programUrl) {
      disposeBusGraph(sharedRef.current);
      disposeBusGraph(previewOnlyRef.current);
      disposeBusGraph(programOnlyRef.current);
      sharedRef.current = null;
      previewOnlyRef.current = null;
      programOnlyRef.current = null;
      setPreviewStream?.(null);
      setProgramStream?.(null);
      return;
    }

    if (!transportPlaying) {
      syncElementPlay(sharedRef.current?.el ?? null, false);
      syncElementPlay(previewOnlyRef.current?.el ?? null, false);
      syncElementPlay(programOnlyRef.current?.el ?? null, false);
      return;
    }

    if (sameClip && previewUrl) {
      disposeBusGraph(previewOnlyRef.current);
      disposeBusGraph(programOnlyRef.current);
      previewOnlyRef.current = null;
      programOnlyRef.current = null;

      if (!sharedRef.current || sharedRef.current.playUrl !== previewUrl) {
        disposeBusGraph(sharedRef.current);
        sharedRef.current = createBusGraph(previewUrl, previewLoop);
      }
      syncElementPlay(sharedRef.current.el, true);
      previewStream = sharedRef.current.previewDest.stream;
      programStream = sharedRef.current.programDest.stream;
    } else {
      disposeBusGraph(sharedRef.current);
      sharedRef.current = null;

      if (previewUrl) {
        if (!previewOnlyRef.current || previewOnlyRef.current.playUrl !== previewUrl) {
          disposeBusGraph(previewOnlyRef.current);
          previewOnlyRef.current = createBusGraph(previewUrl, previewLoop);
        }
        syncElementPlay(previewOnlyRef.current.el, true);
        previewStream = previewOnlyRef.current.previewDest.stream;
      } else {
        disposeBusGraph(previewOnlyRef.current);
        previewOnlyRef.current = null;
      }

      if (programUrl) {
        if (!programOnlyRef.current || programOnlyRef.current.playUrl !== programUrl) {
          disposeBusGraph(programOnlyRef.current);
          programOnlyRef.current = createBusGraph(programUrl, programLoop);
        }
        syncElementPlay(programOnlyRef.current.el, true);
        programStream = programOnlyRef.current.programDest.stream;
      } else {
        disposeBusGraph(programOnlyRef.current);
        programOnlyRef.current = null;
      }
    }

    setPreviewStream?.(previewStream);
    setProgramStream?.(programStream);
  }, [
    transportPlaying,
    previewUrl,
    programUrl,
    sameClip,
    previewLoop,
    programLoop,
    setPreviewStream,
    setProgramStream,
  ]);

  // Mute/unmute via gain only — never tear down decoders mid-playback.
  useEffect(() => {
    if (sharedRef.current) {
      setGainTarget(sharedRef.current.previewGain, previewAllowed ? 1 : 0);
      setGainTarget(sharedRef.current.programGain, programAllowed ? 1 : 0);
      return;
    }
    if (previewOnlyRef.current) {
      setGainTarget(previewOnlyRef.current.previewGain, previewAllowed ? 1 : 0);
      setGainTarget(previewOnlyRef.current.programGain, 0);
    }
    if (programOnlyRef.current) {
      setGainTarget(programOnlyRef.current.programGain, programAllowed ? 1 : 0);
      setGainTarget(programOnlyRef.current.previewGain, 0);
    }
  }, [previewAllowed, programAllowed]);

  // Lip-sync decoders to the visible muted video (infrequent — avoids audio crackle).
  useEffect(() => {
    if (!transportPlaying) return;
    let raf = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      if (frames % 20 === 0) {
        const video = mediaFeed?.getActiveVideoElement() ?? null;
        const graphs = [
          sharedRef.current,
          previewOnlyRef.current,
          programOnlyRef.current,
        ].filter(Boolean) as BusGraph[];

        if (video && !video.paused && video.readyState >= 2 && Number.isFinite(video.currentTime)) {
          for (const graph of graphs) {
            if (Math.abs(graph.el.currentTime - video.currentTime) > 0.6) {
              try {
                graph.el.currentTime = video.currentTime;
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transportPlaying, mediaFeed, previewUrl, programUrl]);

  useEffect(() => {
    return () => {
      disposeBusGraph(sharedRef.current);
      disposeBusGraph(previewOnlyRef.current);
      disposeBusGraph(programOnlyRef.current);
      sharedRef.current = null;
      previewOnlyRef.current = null;
      programOnlyRef.current = null;
    };
  }, []);

  return null;
}
