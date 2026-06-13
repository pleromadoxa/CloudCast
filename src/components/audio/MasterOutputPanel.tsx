import { useMemo } from 'react';
import { Power, Radio } from 'lucide-react';
import { unlockDashboardAudio } from '../../lib/audioOutput';
import { useAudioMixerMeters } from '../../context/AudioMixerEngineContext';
import { cn } from '../../lib/utils';
import { MasterOutputMeters } from '../mixer/MasterOutputMeters';
import { InputAudioVisualizer } from '../mixer/InputAudioVisualizer';
import { MixerPhysicalButton } from './MixerPhysicalButton';
import { MixerVerticalFader, volumeToDb } from './MixerVerticalFader';

export interface MasterOutputPanelProps {
  consoleEnabled: boolean;
  peakHoldEnabled: boolean;
  masterVolume: number;
  masterMuted: boolean;
  monitorVolume: number;
  monitorMuted: boolean;
  onToggleConsoleEnabled: () => void;
  onTogglePeakHold: () => void;
  onSetMasterVolume: (value: number) => void;
  onSetMonitorVolume: (value: number) => void;
  onToggleMasterMute: () => void;
  onToggleMonitorMute: () => void;
}

export function MasterOutputPanel({
  consoleEnabled,
  peakHoldEnabled,
  masterVolume,
  masterMuted,
  monitorVolume,
  monitorMuted,
  onToggleConsoleEnabled,
  onTogglePeakHold,
  onSetMasterVolume,
  onSetMonitorVolume,
  onToggleMasterMute,
  onToggleMonitorMute,
}: MasterOutputPanelProps) {
  const mixerMeters = useAudioMixerMeters();
  const masterAnalyser = useMemo(
    () => mixerMeters?.getMasterAnalyser() ?? null,
    [mixerMeters],
  );

  const metersActive = consoleEnabled && !masterMuted;
  const masterDb = volumeToDb(masterVolume);

  return (
    <section
      className={cn(
        'master-output-panel studiolive-panel-glow',
        !consoleEnabled && 'master-output-panel--standby',
        masterMuted && consoleEnabled && 'master-output-panel--muted',
      )}
    >
      <header className="master-output-panel__header">
        <div className="master-output-panel__title-block">
          <Radio className="master-output-panel__icon h-3.5 w-3.5" aria-hidden />
          <div>
            <p className="master-output-panel__title">Master Output</p>
            <p className="master-output-panel__subtitle">Main L/R Bus</p>
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'master-output-panel__power',
            consoleEnabled && 'master-output-panel__power--on',
          )}
          title={consoleEnabled ? 'Console on — click to power off' : 'Console off — click to power on'}
          onClick={() => {
            void unlockDashboardAudio();
            onToggleConsoleEnabled();
          }}
        >
          <span className="master-output-panel__power-led" aria-hidden />
          <Power className="h-3 w-3" aria-hidden />
          <span>POW</span>
        </button>
      </header>

      <div className="master-output-panel__body">
        <div className="master-output-panel__stage">
          <InputAudioVisualizer
            analyser={masterAnalyser}
            enabled={metersActive}
            accent="red"
            layout="stack"
            size="sm"
            showMeters={false}
            className="master-output-panel__visualizer"
          />

          <div className="master-output-panel__toolbar">
            <MixerPhysicalButton
              label="PEAK"
              variant="peak"
              active={peakHoldEnabled}
              title="Peak hold — latches peak LEDs on meters"
              onClick={onTogglePeakHold}
            />
            <MixerPhysicalButton
              label="MON"
              variant="solo"
              active={consoleEnabled && !monitorMuted}
              disabled={!consoleEnabled}
              title="Monitor bus output"
              onClick={() => {
                void unlockDashboardAudio();
                onToggleMonitorMute();
              }}
            />
            <MixerPhysicalButton
              label="MUTE"
              variant="mute"
              active={masterMuted}
              disabled={!consoleEnabled}
              title="Master mute (Shift+M)"
              onClick={() => {
                void unlockDashboardAudio();
                onToggleMasterMute();
              }}
            />
            <div className="master-output-panel__readout">
              <span className="master-output-panel__readout-label">OUT</span>
              <span className="master-output-panel__readout-value">{masterDb} dB</span>
            </div>
          </div>
        </div>

        <div className="master-output-panel__bus">
          <MasterOutputMeters
            analyser={masterAnalyser}
            active={metersActive}
            muted={masterMuted || !consoleEnabled}
            peakHold={peakHoldEnabled}
            size="lg"
          />

          <div className="master-output-panel__faders">
            <MixerVerticalFader
              label="MAIN L/R"
              value={masterVolume}
              onChange={onSetMasterVolume}
              disabled={!consoleEnabled || masterMuted}
              accent="red"
              height={140}
            />
            <MixerVerticalFader
              label="MONITOR"
              value={monitorVolume}
              onChange={onSetMonitorVolume}
              disabled={!consoleEnabled || monitorMuted}
              accent="green"
              height={110}
            />
          </div>
        </div>
      </div>

      {!consoleEnabled && (
        <div className="master-output-panel__standby-badge" aria-live="polite">
          STANDBY
        </div>
      )}
    </section>
  );
}
