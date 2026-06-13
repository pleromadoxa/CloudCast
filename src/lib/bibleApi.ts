/** Bible lookup — helloao.org, bible-api.com, and API.Bible (licensed). */

import { parseBibleReference, type ParsedBibleReference } from './bibleBooks';
import { isApiBibleConfigured, lookupViaApiBible } from './bibleApiDotBible';

export type BibleTranslationId = string;

export interface BibleTranslation {
  id: BibleTranslationId;
  label: string;
  shortLabel: string;
  /** helloao.org translation id */
  helloaoId?: string;
  /** bible-api.com id for fallback */
  bibleApiId?: string;
  /** Requires API.Bible key — NKJV, NIV, MSG, TPT, etc. */
  licensed?: boolean;
  group: 'popular' | 'classic' | 'modern' | 'licensed';
}

export const BIBLE_TRANSLATIONS: BibleTranslation[] = [
  { id: 'bsb', label: 'Berean Standard Bible', shortLabel: 'BSB', helloaoId: 'BSB', group: 'popular' },
  { id: 'web', label: 'World English Bible', shortLabel: 'WEB', helloaoId: 'ENGWEBP', bibleApiId: 'web', group: 'popular' },
  { id: 'kjv', label: 'King James Version', shortLabel: 'KJV', helloaoId: 'eng_kjv', bibleApiId: 'kjv', group: 'popular' },
  { id: 'nkjv', label: 'New King James Version', shortLabel: 'NKJV', licensed: true, group: 'licensed' },
  { id: 'niv', label: 'New International Version', shortLabel: 'NIV', licensed: true, group: 'licensed' },
  { id: 'esv', label: 'English Standard Version', shortLabel: 'ESV', licensed: true, group: 'licensed' },
  { id: 'nasb', label: 'New American Standard Bible', shortLabel: 'NASB', licensed: true, group: 'licensed' },
  { id: 'nlt', label: 'New Living Translation', shortLabel: 'NLT', licensed: true, group: 'licensed' },
  { id: 'msg', label: 'The Message', shortLabel: 'MSG', licensed: true, group: 'licensed' },
  { id: 'tpt', label: 'The Passion Translation', shortLabel: 'TPT', licensed: true, group: 'licensed' },
  { id: 'net', label: 'NET Bible', shortLabel: 'NET', helloaoId: 'eng_net', group: 'popular' },
  { id: 'asv', label: 'American Standard Version', shortLabel: 'ASV', helloaoId: 'eng_asv', bibleApiId: 'asv', group: 'classic' },
  { id: 'bbe', label: 'Bible in Basic English', shortLabel: 'BBE', helloaoId: 'eng_bbe', bibleApiId: 'bbe', group: 'classic' },
  { id: 'darby', label: 'Darby Translation', shortLabel: 'DBY', helloaoId: 'eng_dby', bibleApiId: 'darby', group: 'classic' },
  { id: 'ylt', label: "Young's Literal Translation", shortLabel: 'YLT', helloaoId: 'eng_ylt', bibleApiId: 'ylt', group: 'classic' },
  { id: 'dra', label: 'Douay-Rheims 1899', shortLabel: 'DRA', helloaoId: 'eng_dra', bibleApiId: 'dra', group: 'classic' },
  { id: 'gnv', label: 'Geneva Bible 1599', shortLabel: 'GNV', helloaoId: 'eng_gnv', group: 'classic' },
  { id: 'webbe', label: 'World English Bible (British)', shortLabel: 'WEBBE', helloaoId: 'eng_webpb', bibleApiId: 'webbe', group: 'modern' },
  { id: 'oeb', label: 'Open English Bible', shortLabel: 'OEB', bibleApiId: 'oeb-us', group: 'modern' },
  { id: 'fbv', label: 'Free Bible Version', shortLabel: 'FBV', helloaoId: 'eng_fbv', group: 'modern' },
  { id: 'lsv', label: 'Literal Standard Version', shortLabel: 'LSV', helloaoId: 'eng_lsv', group: 'modern' },
  { id: 'msb', label: 'Majority Standard Bible', shortLabel: 'MSB', helloaoId: 'eng_msb', group: 'modern' },
  { id: 'pev', label: 'Plain English Version', shortLabel: 'PEV', helloaoId: 'eng_pev', group: 'modern' },
];

export function getTranslationById(id: BibleTranslationId): BibleTranslation | undefined {
  return BIBLE_TRANSLATIONS.find((t) => t.id === id);
}

export interface BibleLookupResult {
  reference: string;
  text: string;
  translation: string;
  translationId: BibleTranslationId;
}

interface HelloAoChapterResponse {
  translation?: { englishName?: string; shortName?: string };
  chapter?: {
    content?: Array<{
      type: string;
      number?: number;
      content?: Array<string | { noteId?: number }>;
    }>;
  };
  error?: string;
}

interface BibleApiResponse {
  reference?: string;
  text?: string;
  translation_name?: string;
  translation_id?: string;
  error?: string;
}

function extractVerseText(content: Array<string | { noteId?: number }> | undefined): string {
  if (!content) return '';
  return content
    .filter((part): part is string => typeof part === 'string')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

async function lookupViaHelloAo(
  parsed: ParsedBibleReference,
  helloaoId: string,
  translation: BibleTranslation,
): Promise<BibleLookupResult> {
  const url = `https://bible.helloao.org/api/${helloaoId}/${parsed.book.name}/${parsed.chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);

  const data = (await res.json()) as HelloAoChapterResponse;
  const verses = data.chapter?.content?.filter((c) => c.type === 'verse') ?? [];

  const selected = verses.filter((v) => {
    const n = v.number ?? 0;
    return n >= parsed.verseStart && n <= parsed.verseEnd;
  });

  if (!selected.length) {
    throw new Error(
      `Verses ${parsed.verseStart}${parsed.verseEnd > parsed.verseStart ? `-${parsed.verseEnd}` : ''} not found in ${parsed.book.name} ${parsed.chapter}.`,
    );
  }

  const text = selected
    .map((v) => {
      const body = extractVerseText(v.content);
      return parsed.verseEnd > parsed.verseStart ? `${v.number}. ${body}` : body;
    })
    .join('\n');

  return {
    reference: parsed.formatted,
    text,
    translation: data.translation?.englishName ?? translation.label,
    translationId: translation.id,
  };
}

/** Normalize "John 3:16" → "john+3:16" for bible-api.com */
export function formatBibleReferenceForApi(reference: string): string {
  return reference.trim().toLowerCase().replace(/\s+/g, '+');
}

async function lookupViaBibleApiCom(
  reference: string,
  bibleApiId: string,
  translation: BibleTranslation,
): Promise<BibleLookupResult> {
  const formatted = formatBibleReferenceForApi(reference);
  const url = `https://bible-api.com/${encodeURIComponent(formatted)}?translation=${bibleApiId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lookup failed (${res.status}). Check the reference and try again.`);

  const data = (await res.json()) as BibleApiResponse;
  if (data.error) throw new Error(data.error);
  if (!data.text?.trim()) throw new Error('No text returned for that reference.');

  return {
    reference: data.reference ?? reference.trim(),
    text: data.text.trim(),
    translation: data.translation_name ?? translation.label,
    translationId: translation.id,
  };
}

async function lookupLicensedTranslation(
  parsed: ParsedBibleReference,
  translation: BibleTranslation,
): Promise<BibleLookupResult> {
  if (!isApiBibleConfigured()) {
    throw new Error(
      `${translation.label} requires an API.Bible key. Add VITE_API_BIBLE_KEY to your .env file, or paste the text manually.`,
    );
  }

  const result = await lookupViaApiBible(parsed, translation.id, translation.label);
  if (!result) {
    throw new Error(
      `${translation.label} is not available on your API.Bible plan. Request publisher access at api.bible, or paste the text manually.`,
    );
  }

  return {
    ...result,
    translationId: translation.id,
  };
}

export async function lookupScripture(
  reference: string,
  translationId: BibleTranslationId = 'web',
): Promise<BibleLookupResult> {
  const translation = getTranslationById(translationId);
  if (!translation) throw new Error('Unknown translation.');

  const parsed = parseBibleReference(reference);
  if (!parsed) {
    throw new Error('Enter a reference like John 3:16 or Psalm 23:1-3');
  }

  if (translation.licensed) {
    return lookupLicensedTranslation(parsed, translation);
  }

  if (translation.helloaoId) {
    try {
      return await lookupViaHelloAo(parsed, translation.helloaoId, translation);
    } catch {
      /* fall through */
    }
  }

  if (translation.bibleApiId) {
    try {
      return await lookupViaBibleApiCom(reference, translation.bibleApiId, translation);
    } catch {
      /* fall through */
    }
  }

  if (isApiBibleConfigured()) {
    const apiResult = await lookupViaApiBible(parsed, translation.id, translation.label);
    if (apiResult) {
      return { ...apiResult, translationId: translation.id };
    }
  }

  if (translation.helloaoId) {
    return lookupViaHelloAo(parsed, translation.helloaoId, translation);
  }

  throw new Error('Lookup failed. Check the reference and try again.');
}

export { isApiBibleConfigured } from './bibleApiDotBible';
export { parseBibleReference, searchBibleReferences } from './bibleBooks';
export type { BibleSearchSuggestion } from './bibleBooks';
