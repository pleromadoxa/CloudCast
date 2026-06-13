import { Volume2 } from 'lucide-react';
import { usePrismFeed } from '../../context/PrismFeedContext';

interface PrismAudioPanelProps {
  hasAudio: boolean;
  canUseMixerAudio: boolean;
}

export function PrismAudioPanel({ hasAudio, canUseMixerAudio }: PrismAudioPanelProps) {
  const { state, patchState } = usePrismFeed();

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400">
        <Volume2 className="h-3 w-3" />
        PROGRAM AUDIO
      </p>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={state.programAudioMic}
          onChange={(e) => patchState({ programAudioMic: e.target.checked })}
        />
        Microphone / camera audio
      </label>
      {canUseMixerAudio && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={state.programAudioMixer}
            onChange={(e) => patchState({ programAudioMixer: e.target.checked })}
          />
          Video Mixer PGM audio
        </label>
      )}
      <p className="text-[10px] text-mixer-muted">
        {hasAudio
          ? 'Audio included in RTMP stream and clip recording.'
          : 'Enable microphone or route mixer PGM for audio on output.'}
      </p>
    </div>
  );
}
