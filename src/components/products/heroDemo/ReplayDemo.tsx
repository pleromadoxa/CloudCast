import {
  HeroButton,
  HeroChip,
  HeroFeed,
  HeroMeter,
  HeroPanel,
  HeroTimecode,
  HeroWindow,
} from './shared';
import { formatTimecode, seeded, useDemoTicker } from './heroDemoUtils';

const ANGLES = [
  { label: 'ANGLE 1 · CENTER', variant: 'stage' },
  { label: 'ANGLE 2 · SIDE', variant: 'crowd' },
  { label: 'ANGLE 3 · GOAL CAM', variant: 'sky' },
  { label: 'ANGLE 4 · ROAM', variant: 'desk' },
] as const;

const CLIPS = [
  { name: 'GOAL — 2nd QTR', dur: '0:08', speed: '0.5×' },
  { name: 'SAVE — 3rd QTR', dur: '0:05', speed: '0.25×' },
  { name: 'FOUL REPLAY', dur: '0:11', speed: '1×' },
  { name: 'WINNING SHOT', dur: '0:06', speed: '0.5×' },
];

/** Animated sample of CloudCast Replay — rolling-buffer multi-angle replay. */
export function ReplayDemo() {
  const tick = useDemoTicker(true);

  return (
    <HeroWindow
      title="CloudCast · Replay — 4 Angle"
      badge={<><span className="hero-dot hero-anim-blink" /> BUFFER 60s</>}
      right={<HeroTimecode value={formatTimecode(3205 + tick)} />}
    >
      <div className="hero-rp">
        {/* Multi-angle preview wall. */}
        <div className="hero-rp__wall">
          {ANGLES.map((angle, i) => (
            <div className={`hero-rp-cam ${i === 0 ? 'hero-rp-cam--pgm' : ''}`} key={angle.label}>
              <HeroFeed variant={angle.variant} seed={i + 12}>
                {i === 0 && (
                  <div className="hero-feed__live hero-feed__live--emerald">
                    <span className="hero-dot hero-anim-blink" /> ON PGM
                  </div>
                )}
              </HeroFeed>
              <span className="hero-rp-cam__label">{angle.label}</span>
            </div>
          ))}
        </div>

        {/* Replay program + transport. */}
        <HeroPanel
          title="Replay PGM"
          right={<HeroChip tone="green">SLOW-MO 0.5×</HeroChip>}
          className="hero-rp__pgm"
        >
          <div className="hero-rp__pgm-row">
            <div className="hero-rp__pgm-screen">
              <HeroFeed variant="stage" seed={20}>
                <div className="hero-feed__live hero-feed__live--emerald">
                  <span className="hero-dot hero-anim-blink" /> REPLAY
                </div>
                <div className="hero-rp__speed hero-anim-pulse-ring">0.5×</div>
              </HeroFeed>
            </div>
            <div className="hero-rp__transport">
              <HeroButton tone="green" active>◀◀</HeroButton>
              <HeroButton tone="green" active>▶ PLAY</HeroButton>
              <HeroButton tone="green">▶▶</HeroButton>
              <HeroButton tone="red" active>TAKE TO PGM</HeroButton>
              <div className="hero-rp__speeds">
                {['0.25×', '0.5×', '1×', '2×'].map((s, i) => (
                  <HeroButton key={s} tone={i === 1 ? 'accent' : 'neutral'} active={i === 1}>{s}</HeroButton>
                ))}
              </div>
              <div className="hero-rp__meters">
                <HeroMeter seed={81} vertical={false} accent="green" />
                <HeroMeter seed={82} vertical={false} accent="green" />
              </div>
            </div>
          </div>
        </HeroPanel>

        {/* Rolling timeline + clip bin. */}
        <div className="hero-rp__bottom">
          <HeroPanel title="Rolling Buffer — 60s" right={<HeroChip tone="muted">IN 00:04:12 · OUT 00:04:20</HeroChip>} className="hero-rp__timeline">
            <div className="hero-scrub">
              <div className="hero-scrub__lane">
                {Array.from({ length: 60 }, (_, i) => (
                  <i
                    key={i}
                    className={i >= 38 && i <= 46 ? 'is-marked' : undefined}
                    style={{ opacity: 0.35 + seeded(i, 2) * 0.65 }}
                  />
                ))}
                <div className="hero-scrub__region" aria-hidden />
                <div className="hero-scrub__playhead hero-anim-scrub" aria-hidden />
              </div>
              <div className="hero-scrub__times">
                <span>-60s</span><span>-45s</span><span>-30s</span><span>-15s</span><span>LIVE</span>
              </div>
            </div>
          </HeroPanel>

          <HeroPanel title="Clip Bin" right={<HeroChip tone="accent">4 CLIPS</HeroChip>} className="hero-rp__bin">
            <div className="hero-clip-bin">
              {CLIPS.map((clip, i) => (
                <div className={`hero-clip-row ${i === 3 ? 'hero-clip-row--active' : ''}`} key={clip.name}>
                  <span className="hero-clip-row__thumb">
                    <HeroFeed variant={ANGLES[i % ANGLES.length].variant} seed={i + 30} scanlines={false} />
                  </span>
                  <span className="hero-clip-row__name">{clip.name}</span>
                  <HeroChip tone="muted">{clip.speed}</HeroChip>
                  <span className="hero-clip-row__dur">{clip.dur}</span>
                </div>
              ))}
            </div>
          </HeroPanel>
        </div>
      </div>
    </HeroWindow>
  );
}
