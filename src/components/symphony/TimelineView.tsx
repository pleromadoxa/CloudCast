import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditTool } from '../../hooks/useSymphonyProject';
import type { AutomationPoint, NoteEvent, Region, TimelineMarker, Track, TrackColor } from '../../types/symphony';
import { volumeAtBeat } from '../../lib/symphony/automation';
import {
  BAR_WIDTH,
  BEATS_PER_BAR,
  DND_INSTRUMENT,
  DND_LOOP,
  barFromClientX,
  playheadToPx,
  pxToPosition,
  snapBar,
  type PlayheadPosition,
} from '../../lib/symphony/dragTypes';
import { cn } from '../../lib/utils';
import { AudioWaveform, MidiDots, SegmentedVuMeter, TRACK_COLOR_MAP } from './symphonyUi';
import { SymphonyButton, symPianoKeyClass } from './SymphonyButton';
import { PlayheadTicker } from './PlayheadTicker';

function trackIcon(instrumentId: string): string {
  if (instrumentId.includes('bass')) return '🎸';
  if (instrumentId.startsWith('strings')) return '🎻';
  if (instrumentId.startsWith('drums')) return '🥁';
  if (instrumentId.startsWith('vocals')) return '🎤';
  if (instrumentId.startsWith('brass')) return '🎺';
  if (instrumentId.startsWith('fx')) return '✨';
  if (instrumentId.startsWith('perc')) return '🔔';
  return '🎹';
}

function VolumeMeter({ level, trackColor }: { level: number; trackColor: TrackColor }) {
  return <SegmentedVuMeter level={level} trackColor={trackColor} />;
}

interface TrackHeadersProps {
  tracks: Track[];
  selectedTrackId: string | null;
  meterLevels: Record<string, number>;
  onSelectTrack: (id: string) => void;
  onTrackChange: (id: string, patch: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
  onAddTrack: () => void;
  maxTracks: number;
}

export function TrackHeaders({
  tracks, selectedTrackId, meterLevels, onSelectTrack, onTrackChange, onRemoveTrack, onAddTrack, maxTracks,
}: TrackHeadersProps) {
  return (
    <div className="sym-panel sym-panel--tracks flex w-44 shrink-0 flex-col lg:w-52">
      <div className="sym-panel__header sym-panel__header--ruler">
        <span>Tracks</span>
        {tracks.length < maxTracks && (
          <SymphonyButton variant="toggle" accent="violet" onClick={onAddTrack} className="!min-h-0 px-1.5 py-0.5 text-[8px]">
            + ADD
          </SymphonyButton>
        )}
      </div>
      <div className="sym-panel__scroll min-h-0 flex-1">
        {tracks.map((track) => {
          const colors = TRACK_COLOR_MAP[track.color];
          return (
          <div
            key={track.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectTrack(track.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelectTrack(track.id)}
            className={cn(
              'sym-track-row group',
              selectedTrackId === track.id && 'sym-track-row--selected',
              track.armed && 'sym-track-row--armed',
            )}
            style={{ minHeight: 52 }}
          >
            <div className={cn('sym-track-row__stripe', colors.stripe)} />
            <div className="sym-track-row__body">
              <div className="flex items-center gap-1.5">
                <span className="sym-track-row__index">{track.index}</span>
                <span className="text-sm drop-shadow-sm">{trackIcon(track.instrumentId)}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/90">{track.name}</span>
                <SymphonyButton
                  variant="ms"
                  accent="red"
                  active={track.armed}
                  onClick={(e) => { e.stopPropagation(); onTrackChange(track.id, { armed: !track.armed }); }}
                  title="Arm for record"
                  className="h-4 w-4 text-[7px] opacity-0 group-hover:opacity-100"
                >
                  R
                </SymphonyButton>
              </div>
              <div className="flex items-center gap-1">
                <SymphonyButton variant="ms" accent="yellow" active={track.muted}
                  onClick={(e) => { e.stopPropagation(); onTrackChange(track.id, { muted: !track.muted }); }}>M</SymphonyButton>
                <SymphonyButton variant="ms" accent="violet" active={track.solo}
                  onClick={(e) => { e.stopPropagation(); onTrackChange(track.id, { solo: !track.solo }); }}>S</SymphonyButton>
                <input type="range" min={0} max={100} value={track.volume} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onTrackChange(track.id, { volume: Number(e.target.value) })} className="sym-fader flex-1" />
                <SymphonyButton variant="ghost" accent="red" onClick={(e) => { e.stopPropagation(); onRemoveTrack(track.id); }}
                  className="hidden h-4 w-4 text-[12px] group-hover:inline" title="Remove track">×</SymphonyButton>
              </div>
              <VolumeMeter level={meterLevels[track.id] ?? 0} trackColor={track.color} />
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

interface TimelineViewProps {
  tracks: Track[];
  regions: Region[];
  totalBars: number;
  barWidth?: number;
  cycleStartBar?: number;
  cycleEndBar?: number;
  useCycleRegion?: boolean;
  markers?: TimelineMarker[];
  selectedTrackId: string | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  playheadPosition: { bar: number; beat: number; tick: number };
  playing: boolean;
  selectedRegionId: string | null;
  editTool: EditTool;
  snapEnabled: boolean;
  onSelectRegion: (id: string | null) => void;
  onMoveRegion: (regionId: string, trackId: string, startBar: number) => void;
  onResizeRegion: (regionId: string, lengthBars: number) => void;
  onDropLoop: (loopId: string, trackId: string, startBar: number) => void;
  onDropInstrument: (instrumentId: string, trackId: string) => void;
  onSplitRegionAt: (regionId: string, atBar: number) => void;
  onJoinSelected: () => void;
  onDeleteRegion: (id: string) => void;
  onDuplicateRegion: () => void;
  onSeekStart: () => void;
  onSeek: (position: PlayheadPosition) => void;
  onSeekEnd: (position: PlayheadPosition) => void;
  onSetEditTool: (tool: EditTool) => void;
  onAddMarker: (bar: number) => void;
  onRemoveMarker: (id: string) => void;
  onAddAutomationPoint: (trackId: string, bar: number, beat: number, value: number) => void;
  onClearAutomation: (trackId: string) => void;
}

function AutomationOverlay({
  points, barWidth, laneHeight, fallbackVolume,
}: {
  points: AutomationPoint[];
  barWidth: number;
  laneHeight: number;
  fallbackVolume: number;
}) {
  if (points.length === 0) {
    const y = laneHeight * (1 - fallbackVolume / 100);
    return (
      <svg className="sym-automation-lane pointer-events-none absolute inset-0" width="100%" height={laneHeight}>
        <line x1={0} y1={y} x2="100%" y2={y} className="sym-automation-lane__line sym-automation-lane__line--idle" />
      </svg>
    );
  }

  const sorted = [...points].sort((a, b) => a.bar * 4 + a.beat - (b.bar * 4 + b.beat));
  const maxBeat = Math.max(...sorted.map((p) => p.bar * 4 + p.beat), 16);
  const samples = 64;
  const polyPoints: string[] = [];

  for (let i = 0; i <= samples; i++) {
    const beat = (i / samples) * maxBeat;
    const vol = volumeAtBeat(sorted, beat, fallbackVolume);
    const x = (beat / 4) * barWidth;
    const y = laneHeight * (1 - vol / 100);
    polyPoints.push(`${x},${y}`);
  }

  return (
    <svg className="sym-automation-lane pointer-events-none absolute inset-0 overflow-visible" height={laneHeight}>
      <polyline points={polyPoints.join(' ')} className="sym-automation-lane__line" fill="none" />
      {sorted.map((p, i) => {
        const x = p.bar * barWidth + (p.beat / BEATS_PER_BAR) * barWidth;
        const y = laneHeight * (1 - p.value / 100);
        return <circle key={i} cx={x} cy={y} r={4} className="sym-automation-lane__point" />;
      })}
    </svg>
  );
}

function RegionBlock({
  region, trackColor, selected, editTool, barWidth,
  onPointerDownLeft, onPointerDownRight, onPointerDownMove, onClick,
}: {
  region: Region;
  trackColor: TrackColor;
  selected: boolean;
  editTool: EditTool;
  barWidth: number;
  onPointerDownLeft: (e: React.PointerEvent) => void;
  onPointerDownRight: (e: React.PointerEvent) => void;
  onPointerDownMove: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const c = TRACK_COLOR_MAP[region.color ?? trackColor];
  const isMidi = (region.notes?.length ?? 0) > 4;

  return (
    <div
      className={cn(
        'sym-region absolute top-1 bottom-1 overflow-hidden select-none',
        c.regionClass,
        c.border,
        selected && 'sym-region--selected',
        editTool === 'automation' && selected && 'sym-region--automation',
        region.muted && 'sym-region--muted',
      )}
      style={{ left: region.startBar * barWidth, width: region.lengthBars * barWidth - 2, touchAction: 'none' }}
      onClick={onClick}
      onPointerDown={editTool === 'automation' ? undefined : onPointerDownMove}
    >
      <div className="sym-region__shine" />
      {selected && editTool === 'trim' && (
        <>
          <div className="sym-region__handle sym-region__handle--left" onPointerDown={onPointerDownLeft} />
          <div className="sym-region__handle sym-region__handle--right" onPointerDown={onPointerDownRight} />
        </>
      )}
      <span className="sym-region__label">{region.name}</span>
      {isMidi ? <MidiDots color={region.color ?? trackColor} /> : <AudioWaveform color={region.color ?? trackColor} />}
    </div>
  );
}

export function TimelineView({
  tracks, regions, totalBars, barWidth = BAR_WIDTH, cycleStartBar = 0, cycleEndBar = 8, useCycleRegion,
  markers = [], selectedTrackId,
  zoomLevel, onZoomIn, onZoomOut,
  playheadPosition, playing, selectedRegionId, editTool, snapEnabled,
  onSelectRegion, onMoveRegion, onResizeRegion, onDropLoop, onDropInstrument,
  onSplitRegionAt, onJoinSelected, onDeleteRegion, onDuplicateRegion, onSeekStart, onSeek, onSeekEnd, onSetEditTool,
  onAddMarker, onRemoveMarker, onAddAutomationPoint, onClearAutomation,
}: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const handleSeekStart = useCallback(() => {
    setPlayheadDragging(true);
    onSeekStart();
  }, [onSeekStart]);
  const handleSeekEnd = useCallback((pos: PlayheadPosition) => {
    setPlayheadDragging(false);
    onSeekEnd(pos);
  }, [onSeekEnd]);
  const [dropTarget, setDropTarget] = useState<{ trackId: string; bar: number } | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    regionId: string;
    startX: number;
    origStartBar: number;
    origLength: number;
    origTrackId: string;
  } | null>(null);

  const width = totalBars * barWidth;
  const playheadPx = playheadToPx(playheadPosition.bar, playheadPosition.beat, playheadPosition.tick, barWidth);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing || playheadDragging) return;
    const viewLeft = el.scrollLeft;
    const viewWidth = el.clientWidth;
    const margin = barWidth * 2;
    if (playheadPx < viewLeft + margin) {
      el.scrollLeft = Math.max(0, playheadPx - margin);
    } else if (playheadPx > viewLeft + viewWidth - margin) {
      el.scrollLeft = playheadPx - viewWidth + margin;
    }
  }, [playheadPx, playing, playheadDragging, barWidth]);

  const clientXToPx = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clientX - rect.left + el.scrollLeft;
  }, []);

  const pxToBarLocal = useCallback((px: number) => snapBar(px / barWidth, snapEnabled), [barWidth, snapEnabled]);

  const handleDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const bar = snapBar(barFromClientX(e.clientX, rect.left, scrollRef.current?.scrollLeft ?? 0, barWidth), snapEnabled);
    setDropTarget({ trackId, bar });
  };

  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const bar = snapBar(barFromClientX(e.clientX, rect.left, scrollRef.current?.scrollLeft ?? 0, barWidth), snapEnabled);
    const loopId = e.dataTransfer.getData(DND_LOOP);
    const instrumentId = e.dataTransfer.getData(DND_INSTRUMENT);
    if (loopId) onDropLoop(loopId, trackId, bar);
    if (instrumentId) onDropInstrument(instrumentId, trackId);
    setDropTarget(null);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !scrollRef.current) return;
    const dx = e.clientX - drag.startX;
    const dBars = dx / barWidth;

    if (drag.mode === 'move') {
      const trackIdx = Math.floor((e.clientY - scrollRef.current.getBoundingClientRect().top + scrollRef.current.scrollTop) / 52);
      const targetTrack = tracks[Math.max(0, Math.min(tracks.length - 1, trackIdx))];
      if (targetTrack) {
        onMoveRegion(drag.regionId, targetTrack.id, drag.origStartBar + dBars);
      }
    } else if (drag.mode === 'resize-right') {
      onResizeRegion(drag.regionId, drag.origLength + dBars);
    } else if (drag.mode === 'resize-left') {
      const newStart = drag.origStartBar + dBars;
      const newLen = drag.origLength - dBars;
      if (newLen > 0.25) {
        onMoveRegion(drag.regionId, drag.origTrackId, newStart);
        onResizeRegion(drag.regionId, newLen);
      }
    }
  }, [tracks, onMoveRegion, onResizeRegion, barWidth]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const startDrag = (mode: DragMode, regionId: string, e: React.PointerEvent) => {
    if (editTool !== 'select' && editTool !== 'trim') return;
    e.stopPropagation();
    const region = regions.find((r) => r.id === regionId);
    if (!region) return;
    dragRef.current = {
      mode,
      regionId,
      startX: e.clientX,
      origStartBar: region.startBar,
      origLength: region.lengthBars,
      origTrackId: region.trackId,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  return (
    <div className="sym-timeline flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="sym-timeline__scroll min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width, minHeight: 28 + tracks.length * 52 }}>
          {/* Bar ruler */}
          <div
            className="sym-ruler sticky top-0 z-20"
            onClick={(e) => {
              const px = clientXToPx(e.clientX);
              onSeekEnd(pxToPosition(px, snapEnabled, barWidth));
            }}
            onDoubleClick={(e) => {
              const px = clientXToPx(e.clientX);
              const bar = Math.floor(pxToBarLocal(px));
              onAddMarker(bar);
            }}
          >
            {Array.from({ length: totalBars }).map((_, i) => (
              <div key={i} className="sym-ruler__bar" style={{ left: i * barWidth, width: barWidth }}>
                <span className="sym-ruler__num">{i + 1}</span>
                {[1, 2, 3].map((beat) => (
                  <div key={beat} className="sym-ruler__beat" style={{ left: `${(beat / BEATS_PER_BAR) * 100}%` }} />
                ))}
              </div>
            ))}
            {markers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className="sym-marker"
                style={{ left: marker.bar * barWidth }}
                title={`${marker.name} — double-click to remove`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeekEnd({ bar: marker.bar + 1, beat: 1, tick: 0 });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onRemoveMarker(marker.id);
                }}
              >
                <span className="sym-marker__flag" />
                <span className="sym-marker__name">{marker.name}</span>
              </button>
            ))}
          </div>

          {/* Cycle region overlay */}
          {useCycleRegion && (
            <div
              className="sym-cycle-region pointer-events-none absolute top-0 bottom-0 z-10"
              style={{
                left: cycleStartBar * barWidth,
                width: (cycleEndBar - cycleStartBar) * barWidth,
              }}
            />
          )}

          {/* Track lanes */}
          <div className="relative">
            {tracks.map((track, trackIdx) => {
              const trackRegions = regions.filter((r) => r.trackId === track.id);
              const isDropHere = dropTarget?.trackId === track.id;
              const colors = TRACK_COLOR_MAP[track.color];
              return (
                <div
                  key={track.id}
                  className={cn(
                    'sym-track-lane',
                    trackIdx % 2 === 0 && 'sym-track-lane--alt',
                    isDropHere && 'sym-track-lane--drop',
                    editTool === 'automation' && track.id === selectedTrackId && 'sym-track-lane--automation',
                  )}
                  style={{ height: 52 }}
                  onDragOver={(e) => handleDragOver(e, track.id)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onClick={(e) => {
                    if (editTool !== 'automation' || track.id !== selectedTrackId) return;
                    if ((e.target as HTMLElement).closest('.sym-region')) return;
                    const px = clientXToPx(e.clientX);
                    const absBar = px / barWidth;
                    const bar = Math.floor(absBar);
                    const beat = (absBar - bar) * BEATS_PER_BAR;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const value = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
                    onAddAutomationPoint(track.id, bar, beat, value);
                  }}
                >
                  {Array.from({ length: totalBars }).map((_, i) => (
                    <div
                      key={i}
                      className={cn('sym-grid-bar', i % 2 === 1 && 'sym-grid-bar--shade')}
                      style={{ left: i * barWidth, width: barWidth }}
                    >
                      {[1, 2, 3].map((beat) => (
                        <div key={beat} className="sym-grid-beat" style={{ left: `${(beat / BEATS_PER_BAR) * 100}%` }} />
                      ))}
                    </div>
                  ))}
                  {isDropHere && dropTarget && (
                    <div className={cn('sym-drop-marker', colors.stripe)} style={{ left: dropTarget.bar * barWidth }} />
                  )}
                  {editTool === 'automation' && track.id === selectedTrackId && (
                    <AutomationOverlay
                      points={track.volumeAutomation ?? []}
                      barWidth={barWidth}
                      laneHeight={52}
                      fallbackVolume={track.volume}
                    />
                  )}
                  {trackRegions.map((region) => (
                    <RegionBlock
                      key={region.id}
                      region={region}
                      trackColor={track.color}
                      barWidth={barWidth}
                      selected={selectedRegionId === region.id}
                      editTool={editTool}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editTool === 'split') {
                          const px = clientXToPx(e.clientX);
                          onSplitRegionAt(region.id, pxToBarLocal(px));
                        } else {
                          onSelectRegion(region.id);
                        }
                      }}
                      onPointerDownMove={(e) => startDrag('move', region.id, e)}
                      onPointerDownLeft={(e) => startDrag('resize-left', region.id, e)}
                      onPointerDownRight={(e) => startDrag('resize-right', region.id, e)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Playhead — spans ruler + all tracks */}
          <PlayheadTicker
            bar={playheadPosition.bar}
            beat={playheadPosition.beat}
            tick={playheadPosition.tick}
            playing={playing}
            snapEnabled={snapEnabled}
            barWidth={barWidth}
            clientXToPx={clientXToPx}
            onSeekStart={handleSeekStart}
            onSeek={onSeek}
            onSeekEnd={handleSeekEnd}
            className="absolute top-0 bottom-0 z-30"
          />
        </div>
      </div>

      <div className="sym-edit-strip flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="sym-edit-strip__label">EDIT</span>
        {(['select', 'trim', 'split', 'automation'] as EditTool[]).map((tool) => (
          <SymphonyButton
            key={tool}
            variant="tool"
            accent="violet"
            active={editTool === tool}
            onClick={() => onSetEditTool(tool)}
          >
            {tool}
          </SymphonyButton>
        ))}
        <span className="mx-1 text-white/10">|</span>
        <SymphonyButton variant="tool" accent="neutral" onClick={onZoomOut} title="Zoom out">−</SymphonyButton>
        <span className="text-[9px] font-mono text-white/40 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
        <SymphonyButton variant="tool" accent="neutral" onClick={onZoomIn} title="Zoom in">+</SymphonyButton>
        <span className="mx-1 text-white/10">|</span>
        <SymphonyButton variant="tool" accent="neutral" onClick={onJoinSelected}>JOIN</SymphonyButton>
        <SymphonyButton variant="tool" accent="neutral" onClick={onDuplicateRegion}>DUPLICATE</SymphonyButton>
        {editTool === 'automation' && selectedTrackId && (
          <SymphonyButton variant="tool" accent="yellow" onClick={() => onClearAutomation(selectedTrackId)}>
            CLEAR AUTO
          </SymphonyButton>
        )}
        <SymphonyButton variant="tool" accent="red" onClick={() => selectedRegionId && onDeleteRegion(selectedRegionId)}>
          DELETE
        </SymphonyButton>
      </div>
    </div>
  );
}

/** Interactive piano roll bound to selected region. */
export function PianoRollPanel({
  visible, region, onNotesChange, onPlayNote,
}: {
  visible: boolean;
  region: Region | null;
  onNotesChange: (notes: NoteEvent[]) => void;
  onPlayNote: (pitch: number) => void;
}) {
  const rows = 24;
  const startPitch = 48;
  const beatsVisible = region ? Math.max(4, region.lengthBars * BEATS_PER_BAR) : 16;
  const gridRef = useRef<HTMLDivElement>(null);
  const noteDragRef = useRef<{ index: number; mode: 'move' | 'resize'; startX: number; startY: number; orig: NoteEvent } | null>(null);

  if (!visible) return null;

  const notes = region?.notes ?? [];

  const pitchToRow = (pitch: number) => rows - 1 - (pitch - startPitch);
  const rowToPitch = (row: number) => startPitch + (rows - 1 - row);

  const beatFromEvent = (clientX: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, ((clientX - rect.left) / rect.width) * beatsVisible);
  };

  const pitchFromEvent = (clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return startPitch;
    const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
    return rowToPitch(Math.max(0, Math.min(rows - 1, row)));
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!region || noteDragRef.current) return;
    const beat = Math.floor(beatFromEvent(e.clientX));
    const pitch = pitchFromEvent(e.clientY);
    const existing = notes.findIndex((n) => n.pitch === pitch && Math.floor(n.startBeat) === beat);
    if (existing >= 0) {
      onNotesChange(notes.filter((_, i) => i !== existing));
    } else {
      onNotesChange([...notes, { pitch, startBeat: beat, durationBeats: 1, velocity: 80 }]);
      onPlayNote(pitch);
    }
  };

  const startNoteDrag = (index: number, mode: 'move' | 'resize', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const orig = notes[index];
    if (!orig) return;
    noteDragRef.current = { index, mode, startX: e.clientX, startY: e.clientY, orig: { ...orig } };
    const onMove = (ev: PointerEvent) => {
      const drag = noteDragRef.current;
      if (!drag || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const dx = (ev.clientX - drag.startX) / rect.width * beatsVisible;
      const dy = pitchFromEvent(ev.clientY) - drag.orig.pitch;
      const updated = [...notes];
      if (drag.mode === 'move') {
        updated[drag.index] = {
          ...drag.orig,
          startBeat: Math.max(0, Math.round((drag.orig.startBeat + dx) * 4) / 4),
          pitch: Math.max(0, Math.min(127, drag.orig.pitch + dy)),
        };
      } else {
        updated[drag.index] = {
          ...drag.orig,
          durationBeats: Math.max(0.25, Math.round((drag.orig.durationBeats + dx) * 4) / 4),
        };
      }
      onNotesChange(updated);
    };
    const onUp = () => {
      noteDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="sym-piano-roll h-48 shrink-0">
      <div className="sym-piano-roll__header">
        <span className="sym-piano-roll__title">Piano Roll</span>
        {region ? <span className="sym-piano-roll__region">{region.name}</span> : <span className="text-white/30">Select a region</span>}
      </div>
      <div className="flex h-[calc(100%-28px)]">
        <div className="sym-piano-roll__keys flex w-9 shrink-0 flex-col">
          {Array.from({ length: rows }).map((_, row) => {
            const pitch = rowToPitch(row);
            const isC = pitch % 12 === 0;
            return (
            <div key={row} className={cn('sym-piano-roll__key-label flex-1', isC && 'sym-piano-roll__key-label--c')}>
              {isC ? `C${Math.floor(pitch / 12) - 1}` : ''}
            </div>
          );})}
        </div>
        <div ref={gridRef} className="sym-piano-roll__grid relative flex-1 cursor-crosshair overflow-hidden" onClick={handleGridClick}>
          {Array.from({ length: beatsVisible }).map((_, b) => (
            <div key={b} className={cn('absolute top-0 bottom-0 border-l', b % BEATS_PER_BAR === 0 ? 'border-white/10' : 'border-white/[0.03]')}
              style={{ left: `${(b / beatsVisible) * 100}%` }} />
          ))}
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} className="absolute left-0 right-0 border-t border-white/[0.03]"
              style={{ top: `${(row / rows) * 100}%`, height: `${100 / rows}%` }} />
          ))}
          {notes.map((note, i) => {
            const row = pitchToRow(note.pitch);
            if (row < 0 || row >= rows) return null;
            return (
              <div
                key={i}
                className="sym-piano-roll__note absolute group"
                style={{
                  left: `${(note.startBeat / beatsVisible) * 100}%`,
                  top: `${(row / rows) * 100}%`,
                  width: `${(note.durationBeats / beatsVisible) * 100}%`,
                  height: `${100 / rows - 1}%`,
                }}
                onPointerDown={(e) => startNoteDrag(i, 'move', e)}
              >
                <div
                  className="sym-piano-roll__note-resize absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                  onPointerDown={(e) => { e.stopPropagation(); startNoteDrag(i, 'resize', e); }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** On-screen piano keyboard + optional Web MIDI. */
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function whiteKeyPitches(start: number, count: number): number[] {
  const pitches: number[] = [];
  let p = start;
  while (pitches.length < count) {
    if (WHITE_SEMITONES.includes(p % 12)) pitches.push(p);
    p++;
  }
  return pitches;
}

function hasBlackKeyAfter(pitch: number): boolean {
  const pc = pitch % 12;
  return pc === 0 || pc === 2 || pc === 5 || pc === 7 || pc === 9;
}

export function MidiKeyboardPanel({
  visible, onNoteOn, onNoteOff,
}: {
  visible: boolean;
  onNoteOn: (pitch: number) => void;
  onNoteOff: (pitch: number) => void;
}) {
  useEffect(() => {
    if (!visible || !navigator.requestMIDIAccess) return;
    let inputs: MIDIInput[] = [];
    navigator.requestMIDIAccess().then((access) => {
      inputs = [...access.inputs.values()];
      for (const input of inputs) {
        input.onmidimessage = (msg) => {
          const data = msg.data;
          if (!data || data.length < 2) return;
          const status = data[0];
          const pitch = data[1];
          const velocity = data[2] ?? 0;
          if (status === 144 && velocity > 0) onNoteOn(pitch);
          if (status === 128 || (status === 144 && velocity === 0)) onNoteOff(pitch);
        };
      }
    }).catch(() => { /* Web MIDI unavailable */ });
    return () => { inputs.forEach((i) => { i.onmidimessage = null; }); };
  }, [visible, onNoteOn, onNoteOff]);

  if (!visible) return null;

  const whitePitches = whiteKeyPitches(60, 14);

  return (
    <div className="sym-midi-keyboard shrink-0 px-3 py-2.5">
      <p className="sym-midi-keyboard__label">MIDI Keyboard · Click keys or connect a controller</p>
      <div className="sym-midi-keyboard__keys relative flex h-[4.5rem]">
        {whitePitches.map((pitch) => (
          <button
            key={pitch}
            type="button"
            className={symPianoKeyClass(false)}
            onMouseDown={() => onNoteOn(pitch)}
            onMouseUp={() => onNoteOff(pitch)}
            onMouseLeave={() => onNoteOff(pitch)}
          >
            {['C', 'D', 'E', 'F', 'G', 'A', 'B'][WHITE_SEMITONES.indexOf(pitch % 12)] ?? ''}
          </button>
        ))}
        {whitePitches.map((pitch, i) => {
          if (!hasBlackKeyAfter(pitch)) return null;
          const blackPitch = pitch + 1;
          return (
            <button
              key={`b-${blackPitch}`}
              type="button"
              className={symPianoKeyClass(true)}
              style={{ left: `${((i + 1) / whitePitches.length) * 100 - (100 / whitePitches.length / 2)}%` }}
              onMouseDown={() => onNoteOn(blackPitch)}
              onMouseUp={() => onNoteOff(blackPitch)}
              onMouseLeave={() => onNoteOff(blackPitch)}
            />
          );
        })}
      </div>
    </div>
  );
}
