import {
  HeroButton,
  HeroChip,
  HeroFader,
  HeroLowerThird,
  HeroMeter,
  HeroPanel,
  HeroWindow,
} from './shared';
import { seeded } from './heroDemoUtils';

const CAMERAS = ['CAM 1 · WIDE', 'CAM 2 · JIB', 'CAM 3 · HOST', 'CAM 4 · DESK'];

const LAYERS = [
  { name: 'Virtual Set — Regal Hall', on: true },
  { name: 'AR Video Wall', on: true },
  { name: 'Floor Reflection', on: true },
  { name: 'Motion Graphics', on: true },
  { name: 'Green Screen Key', on: true },
  { name: 'Audience Depth', on: false },
];

/** Animated sample of Regal Prism — the browser virtual production studio. */
export function PrismDemo() {
  return (
    <HeroWindow
      title="Regal Prism · Virtual Studio"
      badge={<><span className="hero-dot hero-anim-blink" /> VP LIVE</>}
      right={<HeroChip tone="accent">SCENE · REGAL HALL</HeroChip>}
    >
      <div className="hero-pr">
        {/* Virtual set viewport — a CSS-3D studio stage. */}
        <div className="hero-pr__stage">
          <div className="hero-pr__scene hero-anim-camera">
            <div className="hero-pr__wall">
              <div className="hero-pr__screen hero-anim-shimmer">
                <span>REGAL HALL</span>
              </div>
              <div className="hero-pr__screen hero-pr__screen--side hero-anim-shimmer">
                <span>LIVE</span>
              </div>
            </div>
            <div className="hero-pr__floor" aria-hidden>
              <div className="hero-pr__grid" />
              <div className="hero-pr__reflection" aria-hidden />
            </div>
            <div className="hero-pr__desk" aria-hidden />
            <div className="hero-pr__host" aria-hidden />
            <div className="hero-pr__beam hero-anim-beam" aria-hidden />
            <div className="hero-pr__beam hero-pr__beam--b hero-anim-beam" aria-hidden />
          </div>
          <div className="hero-pr__overlay">
            <HeroLowerThird title="THE MORNING SHOW" sub="Regal Prism · Virtual Set" accent="#f59e0b" />
            <div className="hero-feed__live hero-feed__live--amber">
              <span className="hero-dot hero-anim-blink" /> AR GRAPHICS
            </div>
          </div>
          <div className="hero-pr__hud">
            <HeroChip tone="amber">CAM 1 · 35mm</HeroChip>
            <HeroChip tone="muted">KEY SPILL 4%</HeroChip>
            <HeroChip tone="green">TRACKING LOCKED</HeroChip>
          </div>
        </div>

        {/* Panels — layers, cameras, chroma. */}
        <div className="hero-pr__side">
          <HeroPanel title="Scene Layers" right={<HeroChip tone="accent">5 / 6 ON</HeroChip>}>
            <div className="hero-pr__layers">
              {LAYERS.map((layer, i) => (
                <div className="hero-pr__layer" key={layer.name}>
                  <span className={`hero-gfx-led ${layer.on ? 'hero-gfx-led--on' : ''}`} />
                  <span className="hero-pr__layer-name">{layer.name}</span>
                  <HeroFader level={layer.on ? 55 + seeded(i, 3) * 45 : 12} seed={i + 41} drift={layer.on} />
                </div>
              ))}
            </div>
          </HeroPanel>

          <HeroPanel title="Virtual Cameras" right={<HeroChip tone="muted">4 ACTIVE</HeroChip>}>
            <div className="hero-pr__cams">
              {CAMERAS.map((cam, i) => (
                <HeroButton key={cam} tone={i === 0 ? 'amber' : 'neutral'} active={i === 0}>
                  {cam}
                </HeroButton>
              ))}
            </div>
            <div className="hero-pr__cam-stats">
              <HeroChip tone="muted">DOLLY 0.24</HeroChip>
              <HeroChip tone="muted">FOCUS f/2.8</HeroChip>
              <HeroChip tone="green">KEY CLEAN</HeroChip>
            </div>
          </HeroPanel>

          <HeroPanel title="Chroma Key" right={<HeroChip tone="green">CLEAN</HeroChip>}>
            <div className="hero-pr__key">
              <div className="hero-pr__swatch-row">
                <span className="hero-pr__swatch" />
                <span className="hero-pr__key-label">KEY COLOR · #00FF00</span>
              </div>
              {['Tolerance', 'Spill', 'Edge', 'Despill'].map((k, i) => (
                <div className="hero-pr__slider" key={k}>
                  <span>{k}</span>
                  <HeroFader level={35 + seeded(i, 7) * 55} seed={i + 55} drift={false} />
                </div>
              ))}
              <div className="hero-pr__audio">
                <HeroMeter seed={91} vertical={false} accent="amber" />
                <HeroMeter seed={92} vertical={false} accent="amber" />
              </div>
            </div>
          </HeroPanel>
        </div>
      </div>
    </HeroWindow>
  );
}
