import type { TransitionSettings, TransitionType } from '../../../types/mixer';
import { TRANSITION_DURATIONS } from '../../../types/mixer';
import { MIXER_QUICK_TERMS } from '../../../config/mixerGuide';
import { FeatureHint } from '../FeatureHint';
import { cn } from '../../../lib/utils';

interface TransitionPanelProps {
  transition: TransitionSettings;
  compact?: boolean;
  onSetType: (t: TransitionType) => void;
  onSetDuration: (ms: number) => void;
  onSetProgress: (v: number) => void;
  onCommitTbar: (v: number) => void;
  onCut: () => void;
  onTake: () => void;
  onFadeBlack: () => void;
  onToggleAutoTrans?: () => void;
  canTake?: boolean;
}

const EFFECTS: TransitionType[] = ['cut', 'mix', 'fade', 'wipe', 'dip'];

export function TransitionPanel({
  transition,
  compact = false,
  onSetType,
  onSetDuration,
  onSetProgress,
  onCommitTbar,
  onCut,
  onTake,
  onFadeBlack,
  onToggleAutoTrans,
  canTake = true,
}: TransitionPanelProps) {
  return (
    <div className={cn('deck-3panel min-h-0 h-full', compact && 'deck-3panel--compact')}>
      <div className="deck-3panel-col deck-3panel-left">
        <p className="atem-group-label">Effect</p>
        <div className="deck-effect-grid">
          {EFFECTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSetType(t)}
              className={cn('deck-pad-btn deck-pad-btn-lg uppercase', transition.type === t && 'atem-toggle-on')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="deck-3panel-col deck-3panel-center">
        <p className="atem-group-label">Duration</p>
        <div className="deck-duration-row">
          {TRANSITION_DURATIONS.map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => onSetDuration(ms)}
              className={cn('deck-pad-btn', transition.durationMs === ms && 'atem-toggle-on')}
            >
              {ms < 1000 ? `${ms}ms` : `${ms / 1000}s`}
            </button>
          ))}
        </div>

        {!compact && (
          <>
            <p className="atem-group-label mt-2">T-Bar</p>
            <div className="deck-tbar-wrap">
              <span className="deck-tbar-label">{Math.round(transition.progress)}%</span>
              <input
                type="range"
                min={0}
                max={100}
                value={transition.progress}
                onChange={(e) => onSetProgress(Number(e.target.value))}
                onMouseUp={(e) => onCommitTbar(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => onCommitTbar(Number((e.target as HTMLInputElement).value))}
                className="deck-tbar-track"
              />
            </div>
          </>
        )}
      </div>

      <div className="deck-3panel-col deck-3panel-right">
        <p className="atem-group-label">Execute</p>
        <FeatureHint className="mb-1">
          {MIXER_QUICK_TERMS.cut} {MIXER_QUICK_TERMS.take}
        </FeatureHint>
        <div className="deck-transport-col">
          <button type="button" onClick={onCut} className="atem-cut-btn deck-transport-btn" title={MIXER_QUICK_TERMS.cut}>
            CUT
          </button>
          <button type="button" onClick={onTake} disabled={!canTake} className="atem-auto-btn deck-transport-btn" title={MIXER_QUICK_TERMS.take}>
            {transition.autoTrans ? 'AUTO' : 'TAKE'}
          </button>
          {onToggleAutoTrans && (
            <button type="button" onClick={onToggleAutoTrans} className={cn('deck-pad-btn', transition.autoTrans && 'atem-toggle-on')} title={MIXER_QUICK_TERMS.autoTrans}>
              A/T
            </button>
          )}
          <button type="button" onClick={onFadeBlack} className="deck-pad-btn deck-ftb-btn" title={MIXER_QUICK_TERMS.ftb}>
            FTB
          </button>
        </div>
      </div>
    </div>
  );
}
