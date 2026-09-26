import { streamWireKey } from './streamAudioHub';

/** Wire a live WebRTC MediaStream to a video element (Chrome-safe track updates). */
export function bindLiveVideoElement(
  el: HTMLVideoElement,
  stream: MediaStream | null | undefined,
): () => void {
  el.autoplay = true;
  el.muted = true;
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.setAttribute('autoplay', '');
  el.setAttribute('muted', '');

  if (!stream) {
    el.srcObject = null;
    return () => undefined;
  }

  const playLive = () => {
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    void el.play().catch(() => undefined);
  };

  const trackCleanups: Array<() => void> = [];
  const wireTrack = (track: MediaStreamTrack) => {
    const onLive = () => playLive();
    track.addEventListener('unmute', onLive);
    track.addEventListener('mute', onLive);
    trackCleanups.push(() => {
      track.removeEventListener('unmute', onLive);
      track.removeEventListener('mute', onLive);
    });
  };

  playLive();
  stream.getTracks().forEach(wireTrack);

  const onTracksChanged = (event: Event) => {
    const trackEvent = event as MediaStreamTrackEvent;
    if (trackEvent.track && event.type === 'addtrack') {
      wireTrack(trackEvent.track);
    }
    playLive();
  };

  stream.addEventListener('addtrack', onTracksChanged);
  stream.addEventListener('removetrack', onTracksChanged);

  return () => {
    stream.removeEventListener('addtrack', onTracksChanged);
    stream.removeEventListener('removetrack', onTracksChanged);
    trackCleanups.forEach((cleanup) => cleanup());
  };
}

export function liveVideoWireKey(stream: MediaStream | null | undefined): string {
  return stream ? streamWireKey(stream) : '';
}
