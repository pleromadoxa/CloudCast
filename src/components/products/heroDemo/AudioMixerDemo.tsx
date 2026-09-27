import {
  HeroButton,
  HeroChip,
  HeroFader,
  HeroKnob,
  HeroMeter,
  HeroPanel,
  HeroWindow,
} from './shared';
import { seeded, useDemoTicker } from './heroDemoUtils';

const CHANNELS = [
  { label: 'HOST MIC', src: 'USB', level: 72 },
  { label: 'CO-HOST', src: 'USB', level: 58 },
  { label: 'PHONE IN', src: 'PHONE', level: 44 },
  { label: 'BAND L', src: 'CARD', level: 81 },
  { label: 'BAND R', src: 'CARD', level: 77 },
  { label: 'MEDIA', src: 'PHONE', level: 36 },
  { label: 'VIDEO PGM', src: 'CARD', level: 52 },
  { label: 'AMBIENCE', src: 'USB', level: 28 },
];

/** Animated sample of the CloudCast Audio Mixer (StudioLive-style console). */
export function AudioMixerDemo() {
  const tick = useDemoTicker(true);

  return (
    <HeroWindow
      title="CloudCast · Audio Mixer — 16ch"
      badge={<>CONSOLE ON</>}
      badgeTone="idle"
      right={<HeroChip tone="green">SCENE A · SUNDAY</HeroChip>}
    >
      <div className="hero-am">
        {/* Digital console LCD + scenes + master. */}
        <div className="hero-am__top">
          <HeroPanel title="Digital Console" right={<HeroChip tone="accent">INPUTS</HeroChip>} className="hero-am__lcd">
            <div className="hero-lcd">
              <div className="hero-lcd__wave hero-anim-wave" aria-hidden>
                {Array.from({ length: 48 }, (_, i) => (
                  <i key={i} style={{ ['--w-seed' as string]: `${seeded(i, tick * 0 + 3)}` }} />
                ))}
              </div>
              <div className="hero-lcd__meta">
                <span>CH 01 · HOST MIC</span>
                <span>GAIN +18 dB · HPF 80 Hz · COMP 3:1</span>
                <span className="hero-lcd__clock">00:0{tick % 10}:{String((tick * 7) % 60).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="hero-scene-row">
              {['A', 'B', 'C', 'D'].map((id, i) => (
                <HeroButton key={id} tone={i === 0 ? 'accent' : 'neutral'} active={i === 0}>
                  {id}
                </HeroButton>
              ))}
              <span className="hero-scene-row__label">SCENES</span>
            </div>
          </HeroPanel>

          <HeroPanel title="Master Output" right={<HeroChip tone="green">-6 dBFS</HeroChip>} className="hero-am__master">
            <div className="hero-master-row">
              <HeroKnob value={78} accent="#22c55e" label="MASTER" />
              <div className="hero-master-faders">
                <HeroFader level={80} seed={31} />
                <HeroFader level={64} seed={32} />
              </div>
              <div className="hero-master-meters">
                <HeroMeter seed={40} accent="green" hot segments={18} />
                <HeroMeter seed={41} accent="green" hot segments={18} />
              </div>
              <div className="hero-master-btns">
                <HeroButton tone="green" active>ON</HeroButton>
                <HeroButton tone="red">MUTE</HeroButton>
                <HeroButton>MON</HeroButton>
              </div>
            </div>
          </HeroPanel>
        </div>

        {/* Channel fader bank. */}
        <HeroPanel title="Channel Bank" right={<HeroChip tone="muted">8 / 16 SHOWN</HeroChip>}>
          <div className="hero-fader-bank">
            {CHANNELS.map((ch, i) => (
              <div className="hero-ch" key={ch.label}>
                <div className="hero-ch__head">
                  <span className={`hero-ch__led ${i < 6 ? 'hero-ch__led--live' : ''}`} />
                  <span className="hero-ch__num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <HeroChip tone="muted" className="hero-ch__src">{ch.src}</HeroChip>
                <div className="hero-ch__meter">
                  <HeroMeter seed={i + 11} accent={i === 3 || i === 4 ? 'amber' : 'sky'} />
                </div>
                <HeroFader level={ch.level} seed={i + 21} />
                <div className="hero-ch__btns">
                  <HeroButton tone={i === 5 ? 'red' : 'neutral'} active={i === 5}>M</HeroButton>
                  <HeroButton tone={i === 2 ? 'amber' : 'neutral'} active={i === 2}>S</HeroButton>
                </div>
                <span className="hero-ch__label">{ch.label}</span>
              </div>
            ))}
          </div>
        </HeroPanel>
      </div>
    </HeroWindow>
  );
}
