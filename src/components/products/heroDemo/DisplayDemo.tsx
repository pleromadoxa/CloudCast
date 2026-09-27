import {
  HeroButton,
  HeroChip,
  HeroPanel,
  HeroWindow,
} from './shared';
import { formatClock, seeded, useDemoTicker } from './heroDemoUtils';

const LYRICS = [
  ['Amazing grace, how sweet the sound', 'that saved a wretch like me'],
  ['I once was lost, but now am found', 'was blind, but now I see'],
  ['The Lord has promised good to me', 'His word my hope secures'],
];

const SLIDE_GRID = [
  'Welcome', 'Verse 1', 'Verse 2', 'Chorus', 'Bridge', 'Scripture', 'Announce', 'Benediction',
];

/** Animated sample of Regal Display — worship lyrics & presentation output. */
export function DisplayDemo() {
  const tick = useDemoTicker(true);
  const remaining = Math.max(0, 754 - tick);

  return (
    <HeroWindow
      title="Regal Display · Presenter"
      badge={<><span className="hero-dot hero-anim-blink" /> OUTPUT LIVE</>}
      right={<HeroChip tone="accent">CONGREGATION FEED · 2 SCREENS</HeroChip>}
    >
      <div className="hero-ds">
        {/* Main output screen with cycling slides. */}
        <div className="hero-ds__output">
          <div className="hero-ds__screen">
            <div className="hero-ds__slides">
              {LYRICS.map((lines, i) => (
                <div
                  key={i}
                  className="hero-ds__slide hero-anim-slide"
                  style={{ ['--slide-delay' as string]: `${i * -6}s` }}
                >
                  <p className="hero-ds__lyric">{lines[0]}</p>
                  <p className="hero-ds__lyric hero-ds__lyric--sub">{lines[1]}</p>
                </div>
              ))}
            </div>
            <div className="hero-ds__glow" aria-hidden />
            <div className="hero-feed__live hero-feed__live--violet">
              <span className="hero-dot hero-anim-blink" /> LIVE OUTPUT
            </div>
          </div>
          <div className="hero-ds__caption">
            <HeroChip tone="accent">SLIDE 2 / 8</HeroChip>
            <span className="hero-ds__song">Amazing Grace · Verse 2</span>
            <HeroChip tone="green">LYRICS</HeroChip>
          </div>
        </div>

        {/* Confidence monitor + slide grid + controls. */}
        <div className="hero-ds__side">
          <HeroPanel title="Confidence Monitor" right={<HeroChip tone="muted">STAGE SCREEN</HeroChip>}>
            <div className="hero-ds__confidence">
              <div className="hero-ds__current">
                <p>{LYRICS[1][0]}</p>
                <p className="hero-ds__lyric--sub">{LYRICS[1][1]}</p>
              </div>
              <div className="hero-ds__next">
                <span className="hero-ds__next-label">NEXT</span>
                <p>{LYRICS[2][0]}</p>
              </div>
              <div className="hero-ds__timer">
                <span className="hero-ds__timer-label">SERVICE CLOCK</span>
                <span className="hero-ds__timer-value">{formatClock(remaining)}</span>
              </div>
            </div>
          </HeroPanel>

          <HeroPanel title="Slides" right={<HeroChip tone="accent">8 IN SHOW</HeroChip>} className="hero-ds__grid-panel">
            <div className="hero-ds__grid">
              {SLIDE_GRID.map((name, i) => (
                <div
                  key={name}
                  className={`hero-ds__cell ${i === 1 ? 'hero-ds__cell--current' : ''} ${i === 2 ? 'hero-ds__cell--next' : ''}`}
                >
                  <span className="hero-ds__cell-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hero-ds__cell-name">{name}</span>
                  <span
                    className="hero-ds__cell-bar hero-anim-shimmer"
                    style={{ ['--shimmer-delay' as string]: `${seeded(i, 4) * -3}s` }}
                  />
                </div>
              ))}
            </div>
          </HeroPanel>

          <HeroPanel title="Output Controls" className="hero-ds__controls">
            <div className="hero-deck-row">
              <HeroButton tone="accent" active>GO</HeroButton>
              <HeroButton>BLANK</HeroButton>
              <HeroButton>LOGO</HeroButton>
              <HeroButton tone="amber" active>MEDIA</HeroButton>
            </div>
            <div className="hero-deck-row">
              <HeroChip tone="muted">FIT · 16:9</HeroChip>
              <HeroChip tone="green">SONGBOOK SYNC</HeroChip>
              <HeroChip tone="muted">CLOCK ON</HeroChip>
            </div>
          </HeroPanel>
        </div>
      </div>
    </HeroWindow>
  );
}
