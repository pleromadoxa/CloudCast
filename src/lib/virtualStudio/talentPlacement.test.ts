import { describe, expect, it } from 'vitest';
import {
  SEATED_FRAME_BOTTOM,
  SEATED_WIDTH_SCALE,
  STANDING_FRAME_BOTTOM,
  seatedTalentPlacement,
  standingTalentPlacement,
  type StudioTalentPlacement,
} from './types';
import { STUDIO_SCENES } from './sceneRegistry';

const base: StudioTalentPlacement = { position: [1.2, 0.9, 0.45], width: 2.4, yaw: 0.3 };

describe('talent placement poses', () => {
  it('seated framing rests the frame bottom at the seat line', () => {
    const seated = seatedTalentPlacement(base);
    expect(seated.pose).toBe('seated');
    const height = (seated.width ?? 0) * (9 / 16);
    expect(seated.position[1] - height / 2).toBeCloseTo(SEATED_FRAME_BOTTOM, 5);
  });

  it('seated framing is tighter than standing', () => {
    expect(seatedTalentPlacement(base).width).toBeCloseTo(2.4 * SEATED_WIDTH_SCALE, 5);
  });

  it('preserves X/Z position and all angles across the conversion', () => {
    const seated = seatedTalentPlacement({ ...base, pitch: 0.1, roll: -0.05 });
    expect(seated.position[0]).toBe(1.2);
    expect(seated.position[2]).toBe(0.45);
    expect(seated.yaw).toBe(0.3);
    expect(seated.pitch).toBe(0.1);
    expect(seated.roll).toBe(-0.05);
  });

  it('standing round-trips from seated', () => {
    const standing = standingTalentPlacement(seatedTalentPlacement(base));
    expect(standing.pose).toBe('standing');
    expect(standing.width).toBeCloseTo(2.4, 5);
    expect(standing.position[0]).toBe(1.2);
    expect(standing.position[2]).toBe(0.45);
    expect(standing.yaw).toBe(0.3);
    const height = (standing.width ?? 0) * (9 / 16);
    expect(standing.position[1] - height / 2).toBeCloseTo(STANDING_FRAME_BOTTOM, 5);
  });

  it('falls back to the standard plate width when none is set', () => {
    const seated = seatedTalentPlacement({ position: [0, 0.9, 0] });
    expect(seated.width).toBeCloseTo(2.4 * SEATED_WIDTH_SCALE, 5);
    expect(seated.width).toBeLessThan(2.4);
  });
});

describe('scene defaults', () => {
  it('desk and sofa shows ship a seated talent framing', () => {
    const seatedScenes = STUDIO_SCENES.filter((s) => s.talent?.pose === 'seated');
    expect(seatedScenes.map((s) => s.id)).toEqual(expect.arrayContaining(['newsroom', 'sports_arena', 'talk_show']));
    for (const scene of seatedScenes) {
      const t = scene.talent!;
      const height = (t.width ?? 2.4) * (9 / 16);
      expect(t.position[1] - height / 2).toBeCloseTo(SEATED_FRAME_BOTTOM, 5);
    }
  });

  it('every scene with talent keeps the plate above the floor', () => {
    for (const scene of STUDIO_SCENES) {
      if (!scene.talent) continue;
      const height = (scene.talent.width ?? 2.4) * (9 / 16);
      expect(scene.talent.position[1] - height / 2).toBeGreaterThanOrEqual(0);
      expect(scene.talent.position[1] + height / 2).toBeLessThan(3.5);
    }
  });
});
