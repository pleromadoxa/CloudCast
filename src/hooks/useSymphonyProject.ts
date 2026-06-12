import { useCallback, useRef, useState } from 'react';
import type { LoopItem, NoteEvent, Region, SymphonyProject, Track, TimelineMarker } from '../types/symphony';
import { LOOP_LIBRARY } from '../lib/symphony/loops';
import { getInstrument } from '../lib/symphony/instruments';
import { duplicateRegion, joinRegions, regionsOverlap, splitRegion, trimRegion } from '../lib/symphony/regionOps';
import { humanizeNotes, quantizeNotes, stretchPatternToTempo } from '../lib/symphony/noteUtils';
import { createDefaultProject, nextTrackColor } from '../lib/symphonyProjectService';
import { snapBar } from '../lib/symphony/dragTypes';
import { normalizeAutomationPoint } from '../lib/symphony/automation';

const MAX_UNDO = 50;

export type EditTool = 'select' | 'trim' | 'split' | 'automation';

export function useSymphonyProject(maxTracks: number) {
  const [project, setProjectRaw] = useState<SymphonyProject>(() => createDefaultProject('Midnight Session'));
  const undoStack = useRef<SymphonyProject[]>([]);
  const redoStack = useRef<SymphonyProject[]>([]);
  const clipboardRef = useRef<Region[]>([]);

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [editTool, setEditTool] = useState<EditTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);

  const commit = useCallback((next: SymphonyProject | ((prev: SymphonyProject) => SymphonyProject)) => {
    setProjectRaw((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      undoStack.current = [...undoStack.current.slice(-MAX_UNDO + 1), prev];
      redoStack.current = [];
      return { ...resolved, updatedAt: new Date().toISOString() };
    });
  }, []);

  const undo = useCallback(() => {
    setProjectRaw((prev) => {
      const stack = undoStack.current;
      if (stack.length === 0) return prev;
      const previous = stack[stack.length - 1];
      undoStack.current = stack.slice(0, -1);
      redoStack.current = [...redoStack.current, prev];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setProjectRaw((prev) => {
      const stack = redoStack.current;
      if (stack.length === 0) return prev;
      const next = stack[stack.length - 1];
      redoStack.current = stack.slice(0, -1);
      undoStack.current = [...undoStack.current, prev];
      return next;
    });
  }, []);

  const updateProject = useCallback((patch: Partial<SymphonyProject>) => {
    commit((prev) => ({ ...prev, ...patch }));
  }, [commit]);

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    commit((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id === id) return { ...t, ...patch };
        if (patch.solo) return { ...t, solo: false };
        return t;
      }),
    }));
  }, [commit]);

  const addTrack = useCallback(() => {
    commit((prev) => {
      if (prev.tracks.length >= maxTracks) return prev;
      const index = prev.tracks.length + 1;
      const track: Track = {
        id: crypto.randomUUID(),
        index,
        name: `Track ${index}`,
        color: nextTrackColor(index - 1),
        instrumentId: 'synth-pad-warm',
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        armed: false,
        reverbSend: 0,
      };
      return { ...prev, tracks: [...prev.tracks, track] };
    });
  }, [commit, maxTracks]);

  const removeTrack = useCallback((trackId: string) => {
    commit((prev) => {
      if (prev.tracks.length <= 1) return prev;
      const tracks = prev.tracks.filter((t) => t.id !== trackId).map((t, i) => ({ ...t, index: i + 1 }));
      const regions = prev.regions.filter((r) => r.trackId !== trackId);
      return { ...prev, tracks, regions };
    });
    setSelectedTrackId((id) => (id === trackId ? null : id));
  }, [commit]);

  const addRegionFromLoop = useCallback((loop: LoopItem, trackId: string, startBar: number) => {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const bar = snapBar(startBar, snapEnabled);
    const stretched = stretchPatternToTempo(
      loop.pattern.map((n) => ({ ...n })),
      loop.bpm,
      project.tempo,
    );
    const region: Region = {
      id: crypto.randomUUID(),
      trackId,
      name: loop.name,
      startBar: bar,
      lengthBars: loop.bars,
      loopId: loop.id,
      notes: stretched,
      color: track.color,
      gain: 100,
      transpose: 0,
    };
    commit((prev) => ({ ...prev, regions: [...prev.regions, region] }));
    setSelectedRegionId(region.id);
  }, [commit, project.tracks, project.tempo, snapEnabled]);

  const addRegionFromDrop = useCallback((loopId: string, trackId: string, startBar: number) => {
    const loop = LOOP_LIBRARY.find((l) => l.id === loopId);
    if (loop) addRegionFromLoop(loop, trackId, startBar);
  }, [addRegionFromLoop]);

  const moveRegion = useCallback((regionId: string, trackId: string, startBar: number) => {
    const bar = snapBar(startBar, snapEnabled);
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => {
        if (r.id !== regionId) return r;
        const moved = { ...r, trackId, startBar: bar };
        const overlaps = prev.regions.some((other) => other.id !== regionId && regionsOverlap(moved, other));
        return overlaps ? r : moved;
      }),
    }));
  }, [commit, snapEnabled]);

  const resizeRegion = useCallback((regionId: string, lengthBars: number) => {
    const len = snapEnabled ? Math.max(1, Math.round(lengthBars)) : Math.max(0.25, lengthBars);
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => {
        if (r.id !== regionId) return r;
        return trimRegion(r, r.startBar, len);
      }),
    }));
  }, [commit, snapEnabled]);

  const deleteRegion = useCallback((regionId: string) => {
    commit((prev) => ({ ...prev, regions: prev.regions.filter((r) => r.id !== regionId) }));
    setSelectedRegionId((id) => (id === regionId ? null : id));
  }, [commit]);

  const duplicateSelectedRegion = useCallback(() => {
    if (!selectedRegionId) return;
    const region = project.regions.find((r) => r.id === selectedRegionId);
    if (!region) return;
    const dup = duplicateRegion(region);
    commit((prev) => ({ ...prev, regions: [...prev.regions, dup] }));
    setSelectedRegionId(dup.id);
  }, [commit, project.regions, selectedRegionId]);

  const splitSelectedRegion = useCallback((atBar: number) => {
    if (!selectedRegionId) return;
    const region = project.regions.find((r) => r.id === selectedRegionId);
    if (!region) return;
    const result = splitRegion(region, atBar);
    if (!result) return;
    const [left, right] = result;
    commit((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.id !== selectedRegionId).concat([left, right]),
    }));
    setSelectedRegionId(right.id);
  }, [commit, selectedRegionId, project.regions]);

  const splitRegionAt = useCallback((regionId: string, atBar: number) => {
    const region = project.regions.find((r) => r.id === regionId);
    if (!region) return;
    const result = splitRegion(region, atBar);
    if (!result) return;
    const [left, right] = result;
    commit((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.id !== regionId).concat([left, right]),
    }));
    setSelectedRegionId(right.id);
  }, [commit, project.regions]);

  const joinSelectedWithNext = useCallback(() => {
    if (!selectedRegionId) return;
    const region = project.regions.find((r) => r.id === selectedRegionId);
    if (!region) return;
    const next = project.regions.find(
      (r) => r.trackId === region.trackId && r.startBar === region.startBar + region.lengthBars,
    );
    if (!next) return;
    const merged = joinRegions(region, next);
    if (!merged) return;
    commit((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.id !== region.id && r.id !== next.id).concat([merged]),
    }));
    setSelectedRegionId(merged.id);
  }, [commit, project.regions, selectedRegionId]);

  const assignInstrument = useCallback((trackId: string, instrumentId: string) => {
    updateTrack(trackId, { instrumentId, name: getInstrument(instrumentId).name });
  }, [updateTrack]);

  const updateRegionNotes = useCallback((regionId: string, notes: NoteEvent[]) => {
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => (r.id === regionId ? { ...r, notes } : r)),
    }));
  }, [commit]);

  const updateRegion = useCallback((regionId: string, patch: Partial<Region>) => {
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => (r.id === regionId ? { ...r, ...patch } : r)),
    }));
  }, [commit]);

  const copySelectedRegion = useCallback(() => {
    if (!selectedRegionId) return;
    const region = project.regions.find((r) => r.id === selectedRegionId);
    if (region) clipboardRef.current = [{ ...region, notes: region.notes?.map((n) => ({ ...n })) }];
  }, [project.regions, selectedRegionId]);

  const cutSelectedRegion = useCallback(() => {
    copySelectedRegion();
    if (selectedRegionId) deleteRegion(selectedRegionId);
  }, [copySelectedRegion, selectedRegionId, deleteRegion]);

  const pasteRegions = useCallback((atBar: number) => {
    if (clipboardRef.current.length === 0) return;
    const bar = snapBar(atBar, snapEnabled);
    const pasted = clipboardRef.current.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      startBar: bar,
      notes: r.notes?.map((n) => ({ ...n })),
    }));
    commit((prev) => ({ ...prev, regions: [...prev.regions, ...pasted] }));
    if (pasted[0]) setSelectedRegionId(pasted[0].id);
  }, [commit, snapEnabled]);

  const quantizeSelectedRegion = useCallback((grid = 0.25) => {
    if (!selectedRegionId) return;
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id === selectedRegionId && r.notes
          ? { ...r, notes: quantizeNotes(r.notes, grid) }
          : r,
      ),
    }));
  }, [commit, selectedRegionId]);

  const humanizeSelectedRegion = useCallback(() => {
    if (!selectedRegionId) return;
    commit((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id === selectedRegionId && r.notes
          ? { ...r, notes: humanizeNotes(r.notes) }
          : r,
      ),
    }));
  }, [commit, selectedRegionId]);

  const transposeSelectedRegion = useCallback((semitones: number) => {
    if (!selectedRegionId) return;
    updateRegion(selectedRegionId, {
      transpose: ((project.regions.find((r) => r.id === selectedRegionId)?.transpose ?? 0) + semitones),
    });
  }, [selectedRegionId, updateRegion, project.regions]);

  const setCycleRegion = useCallback((startBar: number, endBar: number, enabled = true) => {
    commit((prev) => ({
      ...prev,
      cycleStartBar: Math.max(0, startBar),
      cycleEndBar: Math.max(startBar + 1, endBar),
      useCycleRegion: enabled,
    }));
  }, [commit]);

  const addMarker = useCallback((bar: number, name?: string) => {
    commit((prev) => {
      const marker: TimelineMarker = {
        id: crypto.randomUUID(),
        bar: Math.max(0, bar),
        name: name ?? `Marker ${(prev.markers?.length ?? 0) + 1}`,
      };
      return { ...prev, markers: [...(prev.markers ?? []), marker] };
    });
  }, [commit]);

  const removeMarker = useCallback((id: string) => {
    commit((prev) => ({ ...prev, markers: (prev.markers ?? []).filter((m) => m.id !== id) }));
  }, [commit]);

  const addAutomationPoint = useCallback((trackId: string, bar: number, beat: number, value: number) => {
    commit((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const point = normalizeAutomationPoint(bar, beat, value);
        const existing = (t.volumeAutomation ?? []).filter(
          (p) => !(p.bar === point.bar && Math.abs(p.beat - point.beat) < 0.01),
        );
        return { ...t, volumeAutomation: [...existing, point] };
      }),
    }));
  }, [commit]);

  const clearTrackAutomation = useCallback((trackId: string) => {
    commit((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, volumeAutomation: [] } : t)),
    }));
  }, [commit]);

  const appendRecordedNotes = useCallback((trackId: string, notes: NoteEvent[], startBar: number) => {
    commit((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      const existing = prev.regions.find((r) => r.trackId === trackId && r.startBar === startBar);
      if (existing) {
        return {
          ...prev,
          regions: prev.regions.map((r) =>
            r.id === existing.id ? { ...r, notes: [...(r.notes ?? []), ...notes] } : r,
          ),
        };
      }
      const region: Region = {
        id: crypto.randomUUID(),
        trackId,
        name: 'Recording',
        startBar,
        lengthBars: 4,
        notes,
        color: track.color,
      };
      return { ...prev, regions: [...prev.regions, region] };
    });
  }, [commit]);

  const visibleTracks = project.tracks.slice(0, maxTracks);
  const totalBars = Math.max(8, ...project.regions.map((r) => r.startBar + r.lengthBars));
  const selectedRegion = project.regions.find((r) => r.id === selectedRegionId) ?? null;

  return {
    project,
    setProject: commit,
    visibleTracks,
    totalBars,
    selectedTrackId,
    setSelectedTrackId,
    selectedRegionId,
    setSelectedRegionId,
    selectedRegion,
    editTool,
    setEditTool,
    snapEnabled,
    setSnapEnabled,
    updateProject,
    updateTrack,
    addTrack,
    removeTrack,
    addRegionFromLoop,
    addRegionFromDrop,
    moveRegion,
    resizeRegion,
    deleteRegion,
    duplicateSelectedRegion,
    splitSelectedRegion,
    splitRegionAt,
    joinSelectedWithNext,
    assignInstrument,
    updateRegionNotes,
    updateRegion,
    copySelectedRegion,
    cutSelectedRegion,
    pasteRegions,
    quantizeSelectedRegion,
    humanizeSelectedRegion,
    transposeSelectedRegion,
    setCycleRegion,
    addMarker,
    removeMarker,
    addAutomationPoint,
    clearTrackAutomation,
    appendRecordedNotes,
    undo,
    redo,
  };
}
