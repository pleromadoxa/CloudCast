/**
 * Extruded display type for the motion kit.
 *
 * Flat, texture-mapped letters read as UI. Titles in a broadcast package need
 * *stock*: a slab of metal with a chamfered edge that catches the environment
 * map and lets a specular bar rake across the face. This module turns a
 * typeface into per-glyph `TextGeometry` — bevelled, cached and laid out in
 * em units — so the kit can build real 3D wordmarks with per-letter reveal
 * motion, without paying for glyph tessellation more than once per session.
 *
 * Everything is modelled at size 1 (em) and scaled by the caller, which keeps
 * the geometry cache small: one entry per character, not per (text, size) pair.
 */
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';

/** Extrusion depth in em — a chunky slab, not a decal. */
const DEPTH = 0.26;
/** Chamfer depth / width in em: enough to hold a bright edge highlight. */
const BEVEL_THICKNESS = 0.05;
const BEVEL_SIZE = 0.034;
const CURVE_SEGMENTS = 6;
const BEVEL_SEGMENTS = 3;
/** Fallback advance for characters the typeface omits (spaces, tabs). */
const SPACE_ADVANCE = 0.32;
/** Share of the reveal window in which the leading letter starts moving. */
export const LETTER_STAGGER = 0.42;

let fontInstance: Font | null = null;
let fontResolved = false;

/** Parses the bundled typeface once; null when it cannot be read at all. */
function motionFont(): Font | null {
  if (fontResolved) return fontInstance;
  fontResolved = true;
  try {
    fontInstance = new FontLoader().parse(helvetikerBold);
  } catch {
    fontInstance = null;
  }
  return fontInstance;
}

const glyphCache = new Map<string, TextGeometry | null>();

/** Bevelled geometry for a single character at size 1 (null when empty/missing). */
function glyphGeometry(font: Font, char: string): TextGeometry | null {
  const cached = glyphCache.get(char);
  if (cached !== undefined) return cached;
  if (!font.data.glyphs[char]) {
    glyphCache.set(char, null);
    return null;
  }
  let geometry: TextGeometry | null;
  try {
    geometry = new TextGeometry(char, {
      font,
      size: 1,
      depth: DEPTH,
      curveSegments: CURVE_SEGMENTS,
      bevelEnabled: true,
      bevelThickness: BEVEL_THICKNESS,
      bevelSize: BEVEL_SIZE,
      bevelOffset: 0,
      bevelSegments: BEVEL_SEGMENTS,
    });
    geometry.computeBoundingBox();
  } catch {
    geometry = null;
  }
  glyphCache.set(char, geometry);
  return geometry;
}

export interface ExtrudedLetter {
  /** Cached em-sized glyph geometry — shared across every instance. */
  geometry: TextGeometry;
  /** Left edge of the glyph in em units, relative to the anchor. */
  x: number;
  /** Where inside the reveal window this letter starts moving (0–LETTER_STAGGER). */
  delay: number;
}

export interface ExtrudedTextLayout {
  letters: ExtrudedLetter[];
  /** Full line width in em units (advance sum plus tracking). */
  width: number;
  /** Offset that centres the line optically on the anchor, in em units. */
  centerY: number;
}

/**
 * Lays a string out in em units with the typeface's own advances.
 *
 * Returns null when the font cannot service the text (missing glyphs, parse
 * failure) — the caller drops back to raster text instead of drawing boxes or
 * question marks on air.
 */
export function layoutExtrudedText(
  text: string,
  letterSpacing: number,
  align: 'left' | 'center',
): ExtrudedTextLayout | null {
  const font = motionFont();
  if (!font) return null;
  const chars = Array.from(text);
  if (chars.length === 0) return null;

  const advances: number[] = [];
  const geometries: (TextGeometry | null)[] = [];
  for (const char of chars) {
    const glyph = font.data.glyphs[char];
    const isSpace = char.trim() === '';
    if (glyph) {
      advances.push(glyph.ha / font.data.resolution);
    } else if (isSpace) {
      advances.push(SPACE_ADVANCE);
    } else {
      // Typeface has no glyph for it — let the raster path handle the string.
      return null;
    }
    if (isSpace) {
      geometries.push(null);
      continue;
    }
    const geometry = glyphGeometry(font, char);
    if (!geometry) return null;
    geometries.push(geometry);
  }

  const gaps = chars.length - 1;
  const width = advances.reduce((sum, advance) => sum + advance, 0) + letterSpacing * gaps;
  const startX = align === 'left' ? 0 : -width / 2;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const letters: ExtrudedLetter[] = [];
  // Stagger spreads over the glyphs that actually draw, spaces excluded.
  const drawable = geometries.reduce<number>((count, geometry) => count + (geometry ? 1 : 0), 0);
  let cursor = startX;
  for (let i = 0; i < chars.length; i++) {
    const geometry = geometries[i];
    if (geometry) {
      const box = geometry.boundingBox;
      if (box) {
        minY = Math.min(minY, box.min.y);
        maxY = Math.max(maxY, box.max.y);
      }
      letters.push({
        geometry,
        x: cursor,
        delay: (letters.length / Math.max(1, drawable - 1)) * LETTER_STAGGER,
      });
    }
    cursor += advances[i] + letterSpacing;
  }

  const centerY = minY <= maxY ? -(minY + maxY) / 2 : 0;
  return { letters, width, centerY };
}
