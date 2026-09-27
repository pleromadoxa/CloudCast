import { describe, expect, it } from 'vitest';
import { ALL_STUDIO_SCENES, PHOTOREAL_SCENES } from './sceneRegistry';
import { sceneComponentFor } from '../../components/virtualStudio/scenes/sceneComponentMap';

/**
 * An unmapped registry id silently renders the blank cyclorama, which is how
 * every new set ends up looking like the same scene. These guards keep the
 * registry and `StudioSceneRenderer`'s component map in lock-step.
 */
describe('scene component coverage', () => {
  it('maps every registry scene to a component', () => {
    const missing = ALL_STUDIO_SCENES.filter((scene) => !sceneComponentFor(scene.id)).map((scene) => scene.id);
    expect(missing).toEqual([]);
  });

  it('renders a distinct environment for every photorealistic set', () => {
    const components = PHOTOREAL_SCENES.map((scene) => sceneComponentFor(scene.id));
    expect(components.filter((component) => !component)).toEqual([]);
    // Same component object twice = two registry entries showing one scene.
    expect(new Set(components).size).toBe(PHOTOREAL_SCENES.length);
  });

  it('registers every photorealistic scene in the registry', () => {
    const registered = new Set(ALL_STUDIO_SCENES.map((scene) => scene.id));
    expect(PHOTOREAL_SCENES.filter((scene) => !registered.has(scene.id))).toEqual([]);
  });
});

describe('scene registry integrity', () => {
  it('gives every scene unique slot ids', () => {
    for (const scene of ALL_STUDIO_SCENES) {
      const ids = scene.screens.map((slot) => slot.id);
      expect(new Set(ids).size, `${scene.id} has duplicate slot ids`).toBe(ids.length);
    }
  });

  it('resolves every backdrop slot against the scene it belongs to', () => {
    for (const scene of ALL_STUDIO_SCENES) {
      if (!scene.backdropSlotId) continue;
      const exists = scene.screens.some((slot) => slot.id === scene.backdropSlotId);
      expect(exists, `${scene.id} declares backdrop slot "${scene.backdropSlotId}" that does not exist`).toBe(true);
    }
  });

  it('ships every photorealistic set with screens, a talent mark and an accent', () => {
    for (const scene of PHOTOREAL_SCENES) {
      expect(scene.screens.length, `${scene.id} has no screens`).toBeGreaterThan(0);
      expect(scene.talent?.position, `${scene.id} has no talent placement`).toBeDefined();
      expect(scene.accent, `${scene.id} has no accent`).toBeTruthy();
    }
  });
});
