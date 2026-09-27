import {
  HeroButton,
  HeroChip,
  HeroFeed,
  HeroFader,
  HeroLowerThird,
  HeroMeter,
  HeroPanel,
  HeroTimecode,
  HeroWindow,
} from './shared';
import { formatTimecode, seeded, useDemoTicker } from './heroDemoUtils';

const SOURCES = [
  { label: 'CAM 1 · WIDE', variant: 'stage', tone: 'pgm' },
  { label: 'CAM 2 · HOST', variant: 'studio', tone: 'pst' },
  { label: 'CAM 3 · DESK', variant: 'desk', tone: 'idle' },
  { label: 'MOBILE · A', variant: 'crowd', tone: 'idle' },
  { label: 'PRISM · VSET', variant: 'chroma', tone: 'idle' },
  { label: 'MEDIA · OPENER', variant: 'sky', tone: 'idle' },
] as const;

/** Animated sample of the CloudCast Video Mixer dashboard (PST/PGM production). */
export function VideoMixerDemo() {
  const tick = useDemoTicker(true);

  return (
    <HeroWindow
      title="CloudCast · Video Mixer"
      badge={<><span className="hero-dot hero-anim-blink" /> ON AIR</>}
      right={<HeroTimecode value={formatTimecode(1842 + tick)} tone="red" />}
    >
      <div className="hero-vm">
        {/* Monitor row — preview + program. */}
        <div className="hero-vm__monitors">
          <div className="hero-monitor">
            <div className="hero-monitor__head">
              <HeroChip tone="green">PST</HeroChip>
              <span className="hero-monitor__name">CAM 2 · HOST</span>
              <HeroChip tone="muted">1080p60</HeroChip>
            </div>
            <div className="hero-monitor__screen">
              <HeroFeed variant="studio" seed={2} />
              <div className="hero-monitor__safe" aria-hidden />
            </div>
          </div>

          <div className="hero-monitor hero-monitor--pgm">
            <div className="hero-monitor__head">
              <HeroChip tone="live" blink>PGM</HeroChip>
              <span className="hero-monitor__name">CAM 1 · WIDE</span>
              <HeroChip tone="accent">KEY ON</HeroChip>
            </div>
            <div className="hero-monitor__screen">
              <HeroFeed variant="stage" seed={1}>
                <div className="hero-feed__live">
                  <span className="hero-dot hero-anim-blink" /> LIVE
                </div>
                <HeroLowerThird title="SUNDAY GATHERING" sub="Main Stage · Regal Hall" />
                <div className="hero-feed__pip">
                  <HeroFeed variant="desk" seed={5} scanlines={false} />
                </div>
              </HeroFeed>
              <div className="hero-monitor__safe" aria-hidden />
            </div>
          </div>
        </div>

        {/* Source strip. */}
        <HeroPanel
          title="Sources"
          right={<HeroChip tone="accent">6 / 8 SLOTS</HeroChip>}
          className="hero-vm__sources"
        >
          <div className="hero-source-strip">
            {SOURCES.map((src, i) => (
              <div
                key={src.label}
                className={`hero-source-tile hero-source-tile--${src.tone} ${i === 1 ? 'hero-anim-select' : ''}`}
              >
                <HeroFeed variant={src.variant} seed={i + 3} scanlines={false} />
                <span className="hero-source-tile__label">{src.label}</span>
                {src.tone !== 'idle' && (
                  <span className={`hero-source-tile__badge hero-source-tile__badge--${src.tone}`}>
                    {src.tone === 'pgm' ? 'PGM' : 'PST'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </HeroPanel>

        {/* Control deck. */}
        <div className="hero-vm__deck">
          <HeroPanel title="Transition" right={<HeroChip tone="muted">T-BAR</HeroChip>}>
            <div className="hero-deck-row">
              <HeroButton tone="accent" active>MIX</HeroButton>
              <HeroButton>DIP</HeroButton>
              <HeroButton>WIPE</HeroButton>
              <HeroButton tone="red">FTB</HeroButton>
            </div>
            <div className="hero-tbar">
              <div className="hero-tbar__track">
                <div className="hero-tbar__thumb hero-anim-tbar" />
              </div>
              <span className="hero-tbar__value hero-anim-fade-swap">800 ms</span>
            </div>
            <div className="hero-deck-row">
              <HeroButton tone="green" active>CUT</HeroButton>
              <HeroButton tone="green">TAKE</HeroButton>
              <HeroButton>AFV</HeroButton>
              <HeroButton>AUTO</HeroButton>
            </div>
          </HeroPanel>

          <HeroPanel title="Audio" right={<HeroChip tone="green">-12 dBFS</HeroChip>} className="hero-vm__audio">
            <div className="hero-audio-bank">
              {Array.from({ length: 6 }, (_, i) => (
                <div className="hero-audio-ch" key={i}>
                  <HeroMeter seed={i + 1} accent={i === 3 ? 'amber' : 'green'} />
                  <span className="hero-audio-ch__label">{['MIC', 'HOST', 'BAND', 'VID', 'MUS', 'MST'][i]}</span>
                </div>
              ))}
              <div className="hero-audio-ch hero-audio-ch--master">
                <HeroMeter seed={9} accent="red" hot />
                <span className="hero-audio-ch__label">PGM</span>
              </div>
            </div>
          </HeroPanel>

          <HeroPanel title="Graphics" right={<HeroChip tone="accent">3 LIVE</HeroChip>} className="hero-vm__gfx">
            <div className="hero-gfx-list">
              {['Lower Third', 'Score Bug', 'Countdown', 'Ad Zone'].map((g, i) => (
                <div className="hero-gfx-row" key={g}>
                  <span className={`hero-gfx-led ${i < 3 ? 'hero-gfx-led--on' : ''}`} />
                  <span>{g}</span>
                  <HeroFader level={40 + seeded(i, 4) * 55} seed={i + 8} />
                </div>
              ))}
            </div>
          </HeroPanel>
        </div>
      </div>
    </HeroWindow>
  );
}
