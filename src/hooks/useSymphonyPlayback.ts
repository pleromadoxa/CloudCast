import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayheadPosition } from '../lib/symphony/dragTypes';
import { positionToBeats } from '../lib/symphony/dragTypes';
import { SymphonyAudioEngine } from '../lib/symphony/audioEngine';
import type { NoteEvent, SymphonyProject } from '../types/symphony';

export function useSymphonyPlayback(
  project: SymphonyProject,
  onAppendRecordedNotes?: (trackId: string, notes: NoteEvent[], startBar: number) => void,
) {
  const engineRef = useRef<SymphonyAudioEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [looping, setLooping] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(false);
  const [position, setPosition] = useState({ bar: 1, beat: 1, tick: 0 });
  const [meterLevels, setMeterLevels] = useState<Record<string, number>>({});
  const recordedNotesRef = useRef<NoteEvent[]>([]);
  const activeRecordedRef = useRef<Map<number, number>>(new Map());
  const recordStartBeatsRef = useRef(0);
  const scrubbingRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const engine = new SymphonyAudioEngine();
    engineRef.current = engine;
    void engine.init();
    engine.onPositionChange = (bar, beat, tick) => {
      if (!scrubbingRef.current) setPosition({ bar, beat, tick });
    };
    engine.onPlaybackEnd = () => {
      setPlaying(false);
      setPaused(false);
    };
    return () => engine.dispose();
  }, []);

  // Real VU meters from analysers
  useEffect(() => {
    if (!playing && !paused) return;
    const id = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const ids = projectRef.current.tracks.map((t) => t.id);
      setMeterLevels(engine.getMeterLevels(ids));
    }, 60);
    return () => clearInterval(id);
  }, [playing, paused]);

  // Live mixer sync during playback
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || (!playing && !paused)) return;
    engine.syncProjectMix(project);
  }, [project.tracks, project.masterVolume, project.limiterThreshold, playing, paused]);

  useEffect(() => {
    engineRef.current?.setMetronomeEnabled(metronome && playing && !paused);
  }, [metronome, playing, paused]);

  const commitRecording = useCallback(() => {
    if (!recording || recordedNotesRef.current.length === 0) return;
    const armed = projectRef.current.tracks.find((t) => t.armed);
    if (!armed || !onAppendRecordedNotes) return;
    const startBar = Math.floor(recordStartBeatsRef.current / 4);
    onAppendRecordedNotes(armed.id, [...recordedNotesRef.current], startBar);
    recordedNotesRef.current = [];
    activeRecordedRef.current.clear();
  }, [recording, onAppendRecordedNotes]);

  const handlePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.init();

    const armed = project.tracks.find((t) => t.armed);
    if (recording && !armed) {
      setRecording(false);
    }

    if (countIn) {
      await engine.playCountIn(project.tempo, 4);
    }

    if (recording) {
      recordStartBeatsRef.current = positionToBeats(position.bar, position.beat, position.tick);
      recordedNotesRef.current = [];
      activeRecordedRef.current.clear();
    }

    engine.startPlayback(project, looping, metronome);
    setPlaying(true);
    setPaused(false);
  }, [project, looping, countIn, recording, metronome, position]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    setPlaying(false);
    setPaused(true);
  }, []);

  const handleResume = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.init();
    engine.setMetronomeEnabled(metronome);
    engine.resume();
    setPlaying(true);
    setPaused(false);
  }, [metronome]);

  const handleTransport = useCallback(() => {
    if (paused) {
      void handleResume();
    } else if (playing) {
      handlePause();
    } else {
      void handlePlay();
    }
  }, [paused, playing, handleResume, handlePause, handlePlay]);

  const handleStop = useCallback(() => {
    if (recording && (playing || paused)) {
      commitRecording();
    }
    engineRef.current?.stop();
    setPlaying(false);
    setPaused(false);
    setPosition({ bar: 1, beat: 1, tick: 0 });
    setMeterLevels({});
  }, [recording, playing, paused, commitRecording]);

  const previewNotes = useCallback((
    trackId: string,
    instrumentId: string,
    notes: NoteEvent[],
    tempo: number,
  ) => {
    const engine = engineRef.current;
    const track = project.tracks.find((t) => t.id === trackId);
    if (!engine || !track) return;
    void engine.init().then(() => {
      engine.scheduleNotes(
        trackId, instrumentId, notes, 0, tempo, 0,
        track.volume, track.pan, track.muted, track.solo,
        project.tracks.some((t) => t.solo),
        track.reverbSend ?? 0,
      );
    });
  }, [project.tracks]);

  const playNoteLive = useCallback((trackId: string, pitch: number, velocity = 90) => {
    const engine = engineRef.current;
    const track = project.tracks.find((t) => t.id === trackId);
    if (!engine || !track) return;
    void engine.init().then(() => {
      engine.playLiveNote(trackId, track.instrumentId, pitch, velocity);
    });

    if (recording && playing) {
      const absBeat = positionToBeats(position.bar, position.beat, position.tick);
      const localBeat = absBeat - recordStartBeatsRef.current;
      const idx = recordedNotesRef.current.length;
      recordedNotesRef.current.push({
        pitch,
        startBeat: Math.max(0, localBeat),
        durationBeats: 0.25,
        velocity,
      });
      activeRecordedRef.current.set(pitch, idx);
    }
  }, [project.tracks, recording, playing, position]);

  const releaseNoteLive = useCallback((trackId: string, pitch: number) => {
    engineRef.current?.stopLiveNote(trackId, pitch);

    if (!recording || !playing) return;
    const idx = activeRecordedRef.current.get(pitch);
    if (idx === undefined) return;
    const absBeat = positionToBeats(position.bar, position.beat, position.tick);
    const localBeat = absBeat - recordStartBeatsRef.current;
    const note = recordedNotesRef.current[idx];
    if (note) {
      note.durationBeats = Math.max(0.125, localBeat - note.startBeat);
    }
    activeRecordedRef.current.delete(pitch);
  }, [recording, playing, position]);

  const handleSeekStart = useCallback(() => {
    scrubbingRef.current = true;
  }, []);

  const handleSeek = useCallback((pos: PlayheadPosition) => {
    setPosition(pos);
    if (!playing && !paused) {
      engineRef.current?.seekTo(positionToBeats(pos.bar, pos.beat, pos.tick), false);
    }
  }, [playing, paused]);

  const handleSeekEnd = useCallback((pos: PlayheadPosition) => {
    setPosition(pos);
    const beats = positionToBeats(pos.bar, pos.beat, pos.tick);
    engineRef.current?.seekTo(beats, playing);
    scrubbingRef.current = false;
  }, [playing]);

  return {
    engineRef,
    playing,
    paused,
    recording,
    setRecording,
    looping,
    setLooping,
    metronome,
    setMetronome,
    countIn,
    setCountIn,
    position,
    meterLevels,
    handlePlay,
    handlePause,
    handleResume,
    handleTransport,
    handleStop,
    handleSeekStart,
    handleSeek,
    handleSeekEnd,
    previewNotes,
    playNoteLive,
    releaseNoteLive,
  };
}
