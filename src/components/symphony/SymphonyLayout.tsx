import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud, Copy, Download, FolderOpen, Keyboard, LayoutGrid, LogOut, Music2, Piano,
  Redo2, Save, SlidersHorizontal, Undo2, Upload, Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { resolveProductPlan } from '../../lib/productEntitlements';
import { SYMPHONY_TRACKS } from '../../config/products';
import { useSymphonyProject } from '../../hooks/useSymphonyProject';
import { useSymphonyPlayback } from '../../hooks/useSymphonyPlayback';
import { TransportBar } from './TransportBar';
import { LoopBrowser, InstrumentLibraryPanel } from './LoopBrowser';
import { TrackHeaders, TimelineView, PianoRollPanel, MidiKeyboardPanel } from './TimelineView';
import { LOOP_LIBRARY } from '../../lib/symphony/loops';
import type { CloudProjectMeta } from '../../types/symphony';
import {
  deleteCloudProject, exportProjectJson, importProjectJson, listCloudProjects,
  loadProjectFromRegalCloud, saveProjectToRegalCloud,
} from '../../lib/symphonyProjectService';
import { downloadBlob, renderProjectToWav } from '../../lib/symphony/exportMixdown';
import { exportProjectMidi } from '../../lib/symphony/exportMidi';
import { getInstrument } from '../../lib/symphony/instruments';
import { SymphonyButton } from './SymphonyButton';
import { TRACK_COLOR_MAP } from './symphonyUi';
import { cn } from '../../lib/utils';

import { EffectsPanel, CyclePanel } from './EffectsPanel';
import { BAR_WIDTH, ZOOM_LEVELS } from '../../lib/symphony/dragTypes';
import { stretchPatternToTempo } from '../../lib/symphony/noteUtils';

type BottomPanel = 'loops' | 'instruments' | 'effects' | 'cloud';

export function SymphonyLayout() {
  const { profile, signOut } = useAuth();
  const planId = resolveProductPlan(profile, 'symphony_studio');
  const maxTracks = SYMPHONY_TRACKS[planId];

  const sym = useSymphonyProject(maxTracks);
  const playback = useSymphonyPlayback(sym.project, sym.appendRecordedNotes);

  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('loops');
  const [instrumentCategory, setInstrumentCategory] = useState('');
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [showMidiKeyboard, setShowMidiKeyboard] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<CloudProjectMeta[]>([]);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(2);

  const barWidth = BAR_WIDTH * ZOOM_LEVELS[zoomIndex];
  const zoomLevel = ZOOM_LEVELS[zoomIndex];
  const selectedTrack = sym.selectedTrackId
    ? sym.project.tracks.find((t) => t.id === sym.selectedTrackId) ?? null
    : null;

  useEffect(() => { void listCloudProjects().then(setCloudProjects); }, []);

  useEffect(() => {
    if (!sym.selectedTrackId && sym.visibleTracks[0]) {
      sym.setSelectedTrackId(sym.visibleTracks[0].id);
    }
  }, [sym.visibleTracks, sym.selectedTrackId, sym.setSelectedTrackId]);

  const activeTrackId = sym.selectedTrackId ?? sym.visibleTracks[0]?.id ?? null;

  const handlePreviewLoop = useCallback((loop: typeof LOOP_LIBRARY[0]) => {
    const trackId = activeTrackId ?? sym.visibleTracks[0]?.id;
    if (!trackId) return;
    const track = sym.project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const stretched = stretchPatternToTempo(loop.pattern, loop.bpm, sym.project.tempo);
    playback.previewNotes(trackId, track.instrumentId, stretched, sym.project.tempo);
  }, [activeTrackId, sym.project.tracks, sym.project.tempo, sym.visibleTracks, playback]);

  const handleAddLoopToTrack = useCallback((loop: typeof LOOP_LIBRARY[0]) => {
    const trackId = activeTrackId ?? sym.visibleTracks[0]?.id;
    if (!trackId) return;
    sym.addRegionFromLoop(loop, trackId, playback.position.bar - 1);
  }, [activeTrackId, sym, playback.position.bar]);

  const handleSaveToCloud = async () => {
    setCloudLoading(true);
    setCloudStatus(null);
    try {
      const meta = await saveProjectToRegalCloud(sym.project);
      setCloudProjects(await listCloudProjects());
      setCloudStatus(`Saved to Regal Cloud Archive (${meta.name})`);
    } catch (err) {
      setCloudStatus(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCloudLoading(false);
    }
  };

  const handleMixdown = async () => {
    setExporting(true);
    try {
      playback.handleStop();
      const blob = await renderProjectToWav(sym.project);
      downloadBlob(blob, `${sym.project.name}.wav`);
      setCloudStatus('Mixdown exported as WAV');
    } catch {
      setCloudStatus('Mixdown export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleNoteOn = useCallback((pitch: number) => {
    if (!activeTrackId) return;
    playback.playNoteLive(activeTrackId, pitch);
  }, [activeTrackId, playback]);

  const handleNoteOff = useCallback((pitch: number) => {
    if (!activeTrackId) return;
    playback.releaseNoteLive(activeTrackId, pitch);
  }, [activeTrackId, playback]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); playback.handleTransport(); }
      if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); sym.undo(); }
      if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); sym.redo(); }
      if (e.code === 'KeyC' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sym.copySelectedRegion(); }
      if (e.code === 'KeyX' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sym.cutSelectedRegion(); }
      if (e.code === 'KeyV' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sym.pasteRegions(playback.position.bar - 1);
      }
      if (e.code === 'KeyQ' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); sym.quantizeSelectedRegion(); }
      if (e.code === 'Equal' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1)); }
      if (e.code === 'Minus' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setZoomIndex((i) => Math.max(0, i - 1)); }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (sym.selectedRegionId) { e.preventDefault(); sym.deleteRegion(sym.selectedRegionId); }
      }
      if (e.code === 'KeyD' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sym.duplicateSelectedRegion(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playback, sym]);

  return (
    <div className="symphony-shell relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sym-ambient" aria-hidden />
      <div className="sym-top-bar flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <CloudCastLogo variant={CLOUDCAST_NAV_LOGO.variant} className={CLOUDCAST_NAV_LOGO.className} />
          <div className="hidden flex-col sm:flex">
            <span className="sym-brand-title">CloudCast Symphony</span>
            <span className="sym-brand-sub">Regal Studio · Web DAW</span>
          </div>
          {profile && (
            <span className="sym-plan-badge">
              {profile.entitlements?.universal ? 'UNIVERSAL' : planId.toUpperCase()} · {maxTracks} TRK
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SymphonyButton variant="icon" accent="neutral" onClick={() => sym.undo()} title="Undo (⌘Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </SymphonyButton>
          <SymphonyButton variant="icon" accent="neutral" onClick={() => sym.redo()} title="Redo (⌘⇧Z)">
            <Redo2 className="h-3.5 w-3.5" />
          </SymphonyButton>
          <SymphonyButton variant="toggle" accent="violet" active={sym.snapEnabled} onClick={() => sym.setSnapEnabled(!sym.snapEnabled)}>
            SNAP
          </SymphonyButton>
          <SymphonyButton variant="default" accent="violet" onClick={() => { void handleSaveToCloud(); }} disabled={cloudLoading}>
            <Cloud className="h-3 w-3" /> REGAL CLOUD
          </SymphonyButton>
          <SymphonyButton variant="default" accent="neutral" onClick={() => { void handleMixdown(); }} disabled={exporting} className="hidden sm:inline-flex">
            <Download className="h-3 w-3" /> MIXDOWN
          </SymphonyButton>
          <SymphonyButton variant="default" accent="neutral" onClick={() => exportProjectMidi(sym.project)} className="hidden sm:inline-flex">
            <Music2 className="h-3 w-3" /> MIDI
          </SymphonyButton>
          <SymphonyButton variant="default" accent="neutral" onClick={() => exportProjectJson(sym.project)} className="hidden sm:inline-flex">
            <Copy className="h-3 w-3" /> EXPORT
          </SymphonyButton>
          <label className="sym-btn sym-btn--default hidden cursor-pointer sm:inline-flex">
            <span className="sym-btn__face gap-1">
              <Upload className="h-3 w-3" /> IMPORT
              <input type="file" accept=".ccsym,.json" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void importProjectJson(file).then((p) => { sym.setProject(p); setCloudStatus(`Imported ${file.name}`); });
              }} />
            </span>
          </label>
          <Link to="/hub" className="sym-btn sym-btn--icon sym-btn--ghost hidden sm:inline-flex" title="Hub">
            <span className="sym-btn__face"><LayoutGrid className="h-3.5 w-3.5" /></span>
          </Link>
          <Link to="/dashboard" className="sym-btn sym-btn--icon sym-btn--ghost hidden lg:inline-flex" title="Video Mixer">
            <span className="sym-btn__face"><Video className="h-3.5 w-3.5" /></span>
          </Link>
          <Link to="/audio" className="sym-btn sym-btn--icon sym-btn--ghost hidden lg:inline-flex" title="Audio Mixer">
            <span className="sym-btn__face"><SlidersHorizontal className="h-3.5 w-3.5" /></span>
          </Link>
          <SymphonyButton variant="ghost" accent="neutral" onClick={() => { void signOut(); }} title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </SymphonyButton>
        </div>
      </div>

      <TransportBar
        playing={playback.playing}
        paused={playback.paused}
        recording={playback.recording}
        looping={playback.looping}
        metronome={playback.metronome}
        countIn={playback.countIn}
        position={playback.position}
        tempo={sym.project.tempo}
        timeSignature={sym.project.timeSignature}
        musicalKey={sym.project.key}
        projectName={sym.project.name}
        onPlay={() => { void playback.handleTransport(); }}
        onPause={playback.handlePause}
        onStop={playback.handleStop}
        onRecord={() => playback.setRecording(!playback.recording)}
        onToggleLoop={() => playback.setLooping(!playback.looping)}
        onToggleMetronome={() => playback.setMetronome(!playback.metronome)}
        onToggleCountIn={() => playback.setCountIn(!playback.countIn)}
        onTempoChange={(tempo) => sym.updateProject({ tempo })}
        onKeyChange={(key) => sym.updateProject({ key })}
        onProjectNameChange={(name) => sym.updateProject({ name })}
      />

      <CyclePanel
        cycleStartBar={sym.project.cycleStartBar}
        cycleEndBar={sym.project.cycleEndBar ?? sym.totalBars}
        useCycleRegion={sym.project.useCycleRegion}
        totalBars={sym.totalBars}
        playheadBar={playback.position.bar}
        onSetCycle={sym.setCycleRegion}
      />

      {cloudStatus && (
        <div className="sym-toast shrink-0 px-4 py-1.5 text-[11px]">{cloudStatus}</div>
      )}

      <div className="sym-workspace flex min-h-0 flex-1">
        <LoopBrowser
          selectedLoopId={selectedLoopId}
          onSelectLoop={(loop) => setSelectedLoopId(loop.id)}
          onPreviewLoop={handlePreviewLoop}
          onAddLoopToTrack={handleAddLoopToTrack}
        />

        <TrackHeaders
          tracks={sym.visibleTracks}
          selectedTrackId={sym.selectedTrackId}
          meterLevels={playback.meterLevels}
          onSelectTrack={sym.setSelectedTrackId}
          onTrackChange={sym.updateTrack}
          onRemoveTrack={sym.removeTrack}
          onAddTrack={sym.addTrack}
          maxTracks={maxTracks}
        />

        <TimelineView
          tracks={sym.visibleTracks}
          regions={sym.project.regions}
          totalBars={sym.totalBars}
          barWidth={barWidth}
          cycleStartBar={sym.project.cycleStartBar ?? 0}
          cycleEndBar={sym.project.cycleEndBar ?? sym.totalBars}
          useCycleRegion={sym.project.useCycleRegion}
          zoomLevel={zoomLevel}
          onZoomIn={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
          onZoomOut={() => setZoomIndex((i) => Math.max(0, i - 1))}
          playheadPosition={playback.position}
          playing={playback.playing}
          selectedRegionId={sym.selectedRegionId}
          editTool={sym.editTool}
          snapEnabled={sym.snapEnabled}
          onSelectRegion={sym.setSelectedRegionId}
          onMoveRegion={sym.moveRegion}
          onResizeRegion={sym.resizeRegion}
          onDropLoop={sym.addRegionFromDrop}
          onDropInstrument={sym.assignInstrument}
          onSplitRegionAt={(regionId, bar) => sym.splitRegionAt(regionId, bar)}
          onJoinSelected={sym.joinSelectedWithNext}
          onDeleteRegion={sym.deleteRegion}
          onDuplicateRegion={sym.duplicateSelectedRegion}
          onSeekStart={playback.handleSeekStart}
          onSeek={playback.handleSeek}
          onSeekEnd={playback.handleSeekEnd}
          onSetEditTool={sym.setEditTool}
          markers={sym.project.markers}
          selectedTrackId={sym.selectedTrackId}
          onAddMarker={sym.addMarker}
          onRemoveMarker={sym.removeMarker}
          onAddAutomationPoint={sym.addAutomationPoint}
          onClearAutomation={sym.clearTrackAutomation}
        />

        <aside className="sym-inspector hidden shrink-0 flex-col xl:flex">
          <div className="sym-panel__header">
            <span>Inspector</span>
          </div>
          {sym.selectedTrackId && (() => {
            const track = sym.project.tracks.find((t) => t.id === sym.selectedTrackId);
            if (!track) return null;
            const inst = getInstrument(track.instrumentId);
            const colors = TRACK_COLOR_MAP[track.color];
            return (
              <div className="sym-inspector__body p-4">
                <div className={cn('sym-inspector__color-dot mb-3', colors.stripe)} />
                <input
                  type="text"
                  value={track.name}
                  onChange={(e) => sym.updateTrack(track.id, { name: e.target.value })}
                  className="sym-inspector__input w-full text-sm font-bold"
                />
                <p className="sym-inspector__instrument mt-2">{inst.name}</p>
                <p className="sym-inspector__desc mt-1">{inst.description}</p>
                <div className="sym-inspector__knob-row mt-4">
                  <label className="sym-inspector__knob">
                    <span>Pan</span>
                    <input type="range" min={-100} max={100} value={track.pan}
                      onChange={(e) => sym.updateTrack(track.id, { pan: Number(e.target.value) })}
                      className="sym-fader mt-2 w-full" />
                    <span className="sym-inspector__knob-val">{track.pan > 0 ? `R${track.pan}` : track.pan < 0 ? `L${Math.abs(track.pan)}` : 'C'}</span>
                  </label>
                  <label className="sym-inspector__knob">
                    <span>Volume</span>
                    <input type="range" min={0} max={100} value={track.volume}
                      onChange={(e) => sym.updateTrack(track.id, { volume: Number(e.target.value) })}
                      className="sym-fader mt-2 w-full" />
                    <span className="sym-inspector__knob-val">{track.volume}%</span>
                  </label>
                  <label className="sym-inspector__knob">
                    <span>Reverb</span>
                    <input type="range" min={0} max={100} value={track.reverbSend ?? 0}
                      onChange={(e) => sym.updateTrack(track.id, { reverbSend: Number(e.target.value) })}
                      className="sym-fader mt-2 w-full" />
                    <span className="sym-inspector__knob-val">{track.reverbSend ?? 0}%</span>
                  </label>
                </div>
                {sym.selectedRegion && (
                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <p className="text-[9px] font-bold tracking-wider text-violet-300/60">REGION</p>
                    <p className="mt-1 text-xs font-semibold">{sym.selectedRegion.name}</p>
                    <label className="sym-inspector__knob mt-2 block">
                      <span>Transpose</span>
                      <input type="range" min={-24} max={24} value={sym.selectedRegion.transpose ?? 0}
                        onChange={(e) => sym.updateRegion(sym.selectedRegion!.id, { transpose: Number(e.target.value) })}
                        className="sym-fader mt-1 w-full" />
                    </label>
                  </div>
                )}
                <p className="sym-inspector__hint mt-4">Drag instruments from the library onto this track.</p>
              </div>
            );
          })()}
        </aside>
      </div>

      <PianoRollPanel
        visible={showPianoRoll}
        region={sym.selectedRegion}
        onNotesChange={(notes) => {
          if (sym.selectedRegionId) sym.updateRegionNotes(sym.selectedRegionId, notes);
        }}
        onPlayNote={handleNoteOn}
      />

      <MidiKeyboardPanel visible={showMidiKeyboard} onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />

      {bottomPanel !== 'loops' && (
        <div className="sym-bottom-panel shrink-0 lg:h-44">
          {bottomPanel === 'effects' && (
            <EffectsPanel
              selectedTrack={selectedTrack}
              selectedRegion={sym.selectedRegion}
              masterVolume={sym.project.masterVolume ?? 85}
              limiterThreshold={sym.project.limiterThreshold ?? -18}
              onTrackChange={sym.updateTrack}
              onRegionChange={sym.updateRegion}
              onProjectChange={sym.updateProject}
              onQuantize={() => sym.quantizeSelectedRegion()}
              onHumanize={() => sym.humanizeSelectedRegion()}
              onTranspose={(st) => sym.transposeSelectedRegion(st)}
              onClearAutomation={sym.clearTrackAutomation}
            />
          )}
          {bottomPanel === 'instruments' && (
            <InstrumentLibraryPanel
              category={instrumentCategory}
              onCategoryChange={setInstrumentCategory}
              selectedInstrumentId={sym.selectedTrackId ? sym.project.tracks.find((t) => t.id === sym.selectedTrackId)?.instrumentId ?? null : null}
              onSelectInstrument={(id) => { if (sym.selectedTrackId) sym.assignInstrument(sym.selectedTrackId, id); }}
            />
          )}
          {bottomPanel === 'cloud' && (
            <div className="sym-cloud-panel flex h-full flex-col p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-violet-100">
                <FolderOpen className="h-4 w-4 text-violet-400" /> Regal Cloud Archive
              </div>
              <p className="mt-1 text-[11px] text-white/40">Projects sync securely to Regal Cloud Archive — never lose a session.</p>
              <div className="sym-panel__scroll mt-3 min-h-0 flex-1">
                {cloudProjects.length === 0 ? (
                  <p className="text-[11px] text-white/30">No cloud projects yet. Save your first session above.</p>
                ) : cloudProjects.map((meta) => (
                  <div key={meta.id} className="sym-cloud-item mb-1.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{meta.name}</p>
                      <p className="text-[9px] text-mixer-muted">{(meta.sizeBytes / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-1">
                      <SymphonyButton variant="toggle" accent="violet" onClick={() => {
                        setCloudLoading(true);
                        void loadProjectFromRegalCloud(meta).then((p) => {
                          sym.setProject(p);
                          setCloudStatus(`Loaded "${p.name}"`);
                        }).finally(() => setCloudLoading(false));
                      }}>OPEN</SymphonyButton>
                      <SymphonyButton variant="toggle" accent="red" onClick={() => {
                        void deleteCloudProject(meta).then(() => listCloudProjects().then(setCloudProjects));
                      }}>DELETE</SymphonyButton>
                    </div>
                  </div>
                ))}
              </div>
              <SymphonyButton variant="default" accent="violet" onClick={() => { void handleSaveToCloud(); }} disabled={cloudLoading} className="mt-2 w-full">
                <Save className="h-3 w-3" /> SAVE CURRENT PROJECT
              </SymphonyButton>
            </div>
          )}
        </div>
      )}

      <footer className="sym-dock flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex gap-1">
          {(['loops', 'instruments', 'effects', 'cloud'] as BottomPanel[]).map((panel) => (
            <SymphonyButton
              key={panel}
              variant="toggle"
              accent="violet"
              active={bottomPanel === panel}
              onClick={() => setBottomPanel(panel)}
              className="sym-dock__tab"
            >
              {panel === 'loops' ? '◆ Loops' : panel === 'instruments' ? '♫ Instruments' : panel === 'effects' ? '✦ Effects' : '☁ Regal Cloud'}
            </SymphonyButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SymphonyButton variant="toggle" accent="violet" active={showPianoRoll} onClick={() => setShowPianoRoll((v) => !v)}>
            <Piano className="h-3.5 w-3.5" /> PIANO ROLL
          </SymphonyButton>
          <SymphonyButton variant="toggle" accent="violet" active={showMidiKeyboard} onClick={() => setShowMidiKeyboard((v) => !v)}>
            <Keyboard className="h-3.5 w-3.5" /> MIDI
          </SymphonyButton>
        </div>
      </footer>
    </div>
  );
}
