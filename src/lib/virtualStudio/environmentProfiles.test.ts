import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { environmentForCategory, hostedEnvironmentFiles } from './environmentProfiles';
import type { StudioSceneCategory } from './types';

/**
 * The stage must never request an HDRI that isn't actually hosted — a missing
 * file suspends the scene forever behind the loader, so this pins the code to
 * the files in `public/hdri/`.
 */
describe('environmentProfiles', () => {
  const CATEGORIES: StudioSceneCategory[] = [
    'news',
    'sports',
    'home',
    'talk',
    'worship',
    'weather',
    'business',
    'exterior',
    'concert',
    'blank',
  ];

  it('maps every scene category to an environment', () => {
    for (const category of CATEGORIES) {
      const profile = environmentForCategory(category);
      expect(profile.file, category).toMatch(/^\/hdri\/.+\.hdr$/);
      expect(profile.intensity, category).toBeGreaterThan(0);
    }
  });

  it('has every referenced HDRI file on disk', () => {
    // vitest runs from the repo root; keep this independent of ESM __dirname.
    const root = path.resolve(process.cwd(), 'public');
    for (const file of hostedEnvironmentFiles()) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(true);
    }
  });
});
