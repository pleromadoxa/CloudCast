import { useEffect, useState } from 'react';

/** Bumps when audio/video tracks are added or removed — use as a React dependency. */
export function useStreamAudioRevision(stream: MediaStream | null | undefined): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const bump = () => setRevision((n) => n + 1);

    stream.addEventListener('addtrack', bump);
    stream.addEventListener('removetrack', bump);

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener('ended', bump);
      track.addEventListener('mute', bump);
      track.addEventListener('unmute', bump);
    });

    bump();

    return () => {
      stream.removeEventListener('addtrack', bump);
      stream.removeEventListener('removetrack', bump);
      tracks.forEach((track) => {
        track.removeEventListener('ended', bump);
        track.removeEventListener('mute', bump);
        track.removeEventListener('unmute', bump);
      });
    };
  }, [stream]);

  return revision;
}
