import {
  HeroButton,
  HeroChip,
  HeroFader,
  HeroMeter,
  HeroPanel,
  HeroTimecode,
  HeroWindow,
} from './shared';
import { formatTimecode, seeded, useDemoTicker } from './heroDemoUtils';

const TRACKS = [
  { name: 'DRUMS', color: '#8b5cf6', clips: [0, 3.2, 6.8] },
  { name: 'BASS', color: '#0ea5e9', clips: [1.1, 5.2] },
  { name: 'KEYS', color: '#22c55e', clips: [0.4, 2.6, 6.2, 8.1] },
  { name: 'VOX LEAD', color: '#f59e0b', clips: [3.6, 7.4] },
  { name: 'PADS', color: '#e11d48', clips: [0, 4.8] },
];

/** Animated sample of CloudCast Symphony — the browser DAW / loop studio. */
export function SymphonyDemo() {
  const tick = useDemoTicker(true);

  return (
    <HeroWindow
      title="CloudCast · Symphony Studio"
      badge={<><span className="hero-dot hero-anim-blink" /> PLAYING</>}
      right={<HeroTimecode value={formatTimecode(47 + tick)} />}
    >
      <div className="hero-sym">
        {/* Transport. */}
        <div className="hero-sym__transport">
          <div className="hero-transport-btns">
            <HeroButton>⏮</HeroButton>
            <HeroButton tone="green" active>▶</HeroButton>
            <HeroButton>⏭</HeroButton>
            <HeroButton tone="red" active>● REC</HeroButton>
          </div>
          <HeroChip tone="accent">BPM 128</HeroChip>
          <HeroChip tone="muted">4/4 · SWING 8%</HeroChip>
          <HeroChip tone="green">QUANTIZE 1/16</HeroChip>
          <div className="hero-transport-meters">
            <HeroMeter seed={51} vertical={false} accent="violet" />
            <HeroMeter seed={52} vertical={false} accent="violet" />
          </div>
        </div>

        <div className="hero-sym__main">
          {/* Arrangement timeline. */}
          <HeroPanel title="Arrangement" right={<HeroChip tone="muted">VERSE · CHORUS</HeroChip>} className="hero-sym__timeline">
            <div className="hero-timeline">
              <div className="hero-timeline__ruler">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              {TRACKS.map((track, ti) => (
                <div className="hero-track" key={track.name}>
                  <span className="hero-track__name" style={{ color: track.color }}>
                    {track.name}
                  </span>
                  <div className="hero-track__lane">
                    {track.clips.map((start, ci) => (
                      <div
                        key={ci}
                        className="hero-clip hero-anim-clip"
                        style={{
                          left: `${(start / 9.6) * 100}%`,
                          width: `${(1.6 + seeded(ti * 4 + ci) * 1.8) * 10}%`,
                          background: `linear-gradient(180deg, ${track.color}cc 0%, ${track.color}55 100%)`,
                          ['--clip-delay' as string]: `${seeded(ti + ci, 2) * -4}s`,
                        }}
                      >
                        <span className="hero-clip__wave" aria-hidden />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="hero-playhead hero-anim-playhead" aria-hidden />
            </div>
          </HeroPanel>

          {/* Loop browser + piano roll. */}
          <div className="hero-sym__side">
            <HeroPanel title="Loop Browser" right={<HeroChip tone="accent">128 BPM</HeroChip>}>
              <div className="hero-loops">
                {['Neon Kit', 'Sub Bass', 'Glass Keys', 'Vapor Pad', 'Tape Vox', 'Riser FX'].map((loop, i) => (
                  <div className={`hero-loop ${i === 1 ? 'hero-loop--active' : ''}`} key={loop}>
                    <span className="hero-loop__play">▶</span>
                    <span className="hero-loop__name">{loop}</span>
                    <span className="hero-loop__wave hero-anim-shimmer" aria-hidden />
                  </div>
                ))}
              </div>
            </HeroPanel>

            <HeroPanel title="Piano Roll" right={<HeroChip tone="muted">C MINOR</HeroChip>} className="hero-sym__piano">
              <div className="hero-piano">
                <div className="hero-piano__keys" aria-hidden>
                  {Array.from({ length: 12 }, (_, i) => (
                    <i key={i} className={i % 7 === 1 || i % 7 === 4 ? 'is-black' : undefined} />
                  ))}
                </div>
                <div className="hero-piano__grid">
                  {Array.from({ length: 14 }, (_, i) => (
                    <div
                      key={i}
                      className="hero-note hero-anim-note"
                      style={{
                        top: `${seeded(i, 3) * 82}%`,
                        left: `${(i / 14) * 92}%`,
                        width: `${5 + seeded(i, 6) * 9}%`,
                        background: i % 3 === 0 ? '#8b5cf6' : '#0ea5e9',
                        ['--note-delay' as string]: `${seeded(i, 9) * -3}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </HeroPanel>
          </div>
        </div>

        {/* Mixer strip footer. */}
        <div className="hero-sym__mixer">
          {TRACKS.map((track, i) => (
            <div className="hero-sym-ch" key={track.name}>
              <span className="hero-sym-ch__name" style={{ color: track.color }}>{track.name}</span>
              <HeroFader level={45 + seeded(i, 8) * 45} seed={i + 61} />
              <HeroMeter seed={i + 71} accent="green" />
            </div>
          ))}
          <div className="hero-sym-ch hero-sym-ch--master">
            <span className="hero-sym-ch__name">MASTER</span>
            <HeroFader level={82} seed={99} />
            <HeroMeter seed={98} accent="red" hot />
          </div>
        </div>
      </div>
    </HeroWindow>
  );
}
