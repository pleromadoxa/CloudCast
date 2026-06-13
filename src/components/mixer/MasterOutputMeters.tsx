import { useEffect, useState } from 'react';
import { useAnalyserNodeFrame } from '../../hooks/useAnalyserNodeFrame';
import { usePgmAudioLevels } from '../../context/PgmAudioContext';
import { cn } from '../../lib/utils';
import { VUMeterBar } from './AudioMeters';

const CLIP_THRESHOLD = 94;

interface MasterOutputMetersProps {
  analyser?: AnalyserNode | null;
  active?: boolean;
  muted?: boolean;
  peakHold?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function ClipIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="master-clip-indicator" title={`${label} clip`}>
      <span
        className={cn('master-clip-indicator__led', active && 'master-clip-indicator__led--on')}
        aria-hidden
      />
      <span className="master-clip-indicator__label">{label}</span>
    </div>
  );
}

export function MasterOutputMeters({
  analyser = null,
  active = true,
  muted = false,
  peakHold = false,
  size = 'lg',
}: MasterOutputMetersProps) {
  const pgmLevels = usePgmAudioLevels();
  const nodeFrame = useAnalyserNodeFrame(analyser, active && Boolean(analyser), peakHold);
  const useNode = Boolean(analyser);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!useNode) return;
    return nodeFrame.subscribe(() => setTick((n) => n + 1));
  }, [useNode, nodeFrame]);

  const levels = useNode ? nodeFrame.levels : pgmLevels;
  const frame = useNode ? nodeFrame.frameRef.current : null;

  const l = active ? levels.l : 0;
  const r = active ? levels.r : 0;
  const lPeak = frame?.lPeak ?? 0;
  const rPeak = frame?.rPeak ?? 0;
  void tick;

  const [clipL, setClipL] = useState(false);
  const [clipR, setClipR] = useState(false);

  useEffect(() => {
    if (!active) {
      setClipL(false);
      setClipR(false);
      return;
    }
    if (l >= CLIP_THRESHOLD) setClipL(true);
    if (r >= CLIP_THRESHOLD) setClipR(true);
  }, [active, l, r]);

  const heightClass = size === 'lg' ? 'h-32' : size === 'sm' ? 'h-12' : 'h-20';

  return (
    <div className={cn('master-output-meters', muted && 'master-output-meters--muted')}>
      <div className="master-output-meters__clip-row">
        <ClipIndicator active={clipL && active} label="CLIP L" />
        <ClipIndicator active={clipR && active} label="CLIP R" />
      </div>
      <div className="master-output-meters__bars">
        <VUMeterBar
          level={l}
          peak={lPeak}
          peakHold={peakHold}
          label="L"
          heightClass={heightClass}
          animated
          pro
        />
        <VUMeterBar
          level={r}
          peak={rPeak}
          peakHold={peakHold}
          label="R"
          heightClass={heightClass}
          animated
          pro
        />
      </div>
      {peakHold && (
        <p className="master-output-meters__peak-hint">
          <span className="master-output-meters__peak-dot" aria-hidden />
          PEAK HOLD
        </p>
      )}
    </div>
  );
}
