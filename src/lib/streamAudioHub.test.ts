import { describe, expect, it } from 'vitest';
import {
  hasUsableAudio,
  hasUsableVideo,
  mergeTrackIntoStream,
  mergeTracksIntoStream,
  meshStreamHasBothMedia,
  streamWireKey,
} from './streamAudioHub';

function mockTrack(kind: 'audio' | 'video', id: string): MediaStreamTrack {
  return {
    id,
    kind,
    readyState: 'live',
    enabled: true,
  } as MediaStreamTrack;
}

function mockStream(tracks: MediaStreamTrack[]): MediaStream {
  return {
    id: `stream-${tracks.map((t) => t.id).join('-') || 'empty'}`,
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    addTrack(track: MediaStreamTrack) {
      if (!tracks.some((t) => t.id === track.id)) tracks.push(track);
    },
    removeTrack(track: MediaStreamTrack) {
      const index = tracks.findIndex((t) => t.id === track.id);
      if (index >= 0) tracks.splice(index, 1);
    },
  } as unknown as MediaStream;
}

describe('mergeTrackIntoStream', () => {
  it('merges video and audio into one stream on the same connection', () => {
    const videoStream = mockStream([mockTrack('video', 'v1')]);
    const withAudio = mergeTrackIntoStream(videoStream, mockTrack('audio', 'a1'));

    expect(withAudio.getVideoTracks()).toHaveLength(1);
    expect(withAudio.getAudioTracks()).toHaveLength(1);
    expect(meshStreamHasBothMedia(withAudio)).toBe(true);
  });

  it('does not drop video when a second ontrack arrives with a different stream id', () => {
    const first = mockStream([mockTrack('video', 'v1')]);
    const secondStream = mockStream([mockTrack('audio', 'a1')]);
    const merged = mergeTrackIntoStream(first, mockTrack('audio', 'a1'), secondStream);

    expect(hasUsableVideo(merged)).toBe(true);
    expect(hasUsableAudio(merged)).toBe(true);
  });

  it('replaces an ended video track so a camera restart is not stuck on a frozen frame', () => {
    const ended = mockTrack('video', 'v-old');
    (ended as MediaStreamTrack & { readyState: string }).readyState = 'ended';
    const stream = mockStream([ended]);
    const merged = mergeTrackIntoStream(stream, mockTrack('video', 'v-new'));

    expect(merged.getVideoTracks().map((t) => t.id)).toEqual(['v-new']);
    expect(hasUsableVideo(merged)).toBe(true);
  });

  it('deduplicates tracks by id', () => {
    const stream = mergeTracksIntoStream(null, [
      mockTrack('video', 'v1'),
      mockTrack('video', 'v1'),
    ], mockStream([]));

    expect(stream.getVideoTracks()).toHaveLength(1);
  });
});

describe('streamWireKey', () => {
  it('changes when a video track is added to an audio-only stream', () => {
    const audioOnly = mockStream([mockTrack('audio', 'a1')]);
    const keyBefore = streamWireKey(audioOnly);
    const withVideo = mergeTrackIntoStream(audioOnly, mockTrack('video', 'v1'));
    expect(streamWireKey(withVideo)).not.toBe(keyBefore);
  });
});
