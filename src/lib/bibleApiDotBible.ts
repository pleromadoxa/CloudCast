/** API.Bible (scripture.api.bible) — licensed translations via VITE_API_BIBLE_KEY. */

import type { ParsedBibleReference } from './bibleBooks';

const API_BASE = 'https://api.scripture.api.bible/v1';

export function getApiBibleKey(): string | undefined {
  const key = import.meta.env.VITE_API_BIBLE_KEY?.trim();
  return key || undefined;
}

export function isApiBibleConfigured(): boolean {
  return Boolean(getApiBibleKey());
}

interface ApiBibleListItem {
  id: string;
  abbreviation?: string;
  name?: string;
  nameLocal?: string;
}

interface ApiBiblePassageResponse {
  data?: {
    reference?: string;
    content?: string;
    copyright?: string;
  };
  statusCode?: number;
  error?: string;
  message?: string;
}

let bibleCatalogPromise: Promise<Map<string, string>> | null = null;

/** Abbreviation aliases → search tokens for matching API.Bible catalog entries. */
const ABBREV_SEARCH: Record<string, string[]> = {
  nkjv: ['NKJV', 'NEW KING JAMES'],
  niv: ['NIV', 'NEW INTERNATIONAL'],
  esv: ['ESV', 'ENGLISH STANDARD'],
  nasb: ['NASB', 'NEW AMERICAN STANDARD'],
  nlt: ['NLT', 'NEW LIVING'],
  msg: ['MSG', 'MESSAGE'],
  tpt: ['TPT', 'PASSION TRANSLATION', 'PASSION'],
  kjv: ['KJV', 'KING JAMES'],
  web: ['WEB', 'WORLD ENGLISH'],
  bsb: ['BSB', 'BEREAN STANDARD'],
  asv: ['ASV', 'AMERICAN STANDARD'],
  net: ['NET BIBLE'],
};

function normalizeCatalogKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function fetchBibleCatalog(): Promise<Map<string, string>> {
  const key = getApiBibleKey();
  if (!key) return new Map();

  const res = await fetch(`${API_BASE}/bibles?language=eng`, {
    headers: { 'api-key': key },
  });
  if (!res.ok) return new Map();

  const json = (await res.json()) as { data?: ApiBibleListItem[] };
  const map = new Map<string, string>();

  for (const bible of json.data ?? []) {
    const tokens = [
      bible.abbreviation ?? '',
      bible.name ?? '',
      bible.nameLocal ?? '',
    ];
    for (const token of tokens) {
      const norm = normalizeCatalogKey(token);
      if (norm) map.set(norm, bible.id);
    }
  }
  return map;
}

function getBibleCatalog(): Promise<Map<string, string>> {
  if (!bibleCatalogPromise) {
    bibleCatalogPromise = fetchBibleCatalog().catch(() => new Map());
  }
  return bibleCatalogPromise;
}

/** Resolve API.Bible bible_id from our translation id (e.g. "niv" → bible uuid). */
export async function resolveApiBibleId(translationId: string): Promise<string | null> {
  const catalog = await getBibleCatalog();
  if (!catalog.size) return null;

  const searches = ABBREV_SEARCH[translationId] ?? [translationId.toUpperCase()];
  for (const term of searches) {
    const norm = normalizeCatalogKey(term);
    const direct = catalog.get(norm);
    if (direct) return direct;

    for (const [key, id] of catalog.entries()) {
      if (key.includes(norm) || norm.includes(key)) return id;
    }
  }
  return null;
}

function buildPassageId(parsed: ParsedBibleReference): string {
  const { book, chapter, verseStart, verseEnd } = parsed;
  if (verseEnd > verseStart) {
    return `${book.id}.${chapter}.${verseStart}-${book.id}.${chapter}.${verseEnd}`;
  }
  return `${book.id}.${chapter}.${verseStart}`;
}

function cleanPassageContent(content: string): string {
  return content
    .replace(/\u00b6/g, '')
    .replace(/\[\d+\]/g, (m) => {
      const num = m.slice(1, -1);
      return `\n${num}. `;
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

export async function lookupViaApiBible(
  parsed: ParsedBibleReference,
  translationId: string,
  translationLabel: string,
): Promise<{ reference: string; text: string; translation: string } | null> {
  const key = getApiBibleKey();
  if (!key) return null;

  const bibleId = await resolveApiBibleId(translationId);
  if (!bibleId) return null;

  const passageId = buildPassageId(parsed);
  const params = new URLSearchParams({
    'content-type': 'text',
    'include-verse-numbers': parsed.verseEnd > parsed.verseStart ? 'true' : 'false',
  });

  const res = await fetch(`${API_BASE}/bibles/${bibleId}/passages/${passageId}?${params}`, {
    headers: { 'api-key': key },
  });

  if (res.status === 403 || res.status === 401) {
    throw new Error(
      `${translationLabel} is not licensed on your API.Bible plan. Request access at api.bible or paste the text manually.`,
    );
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiBiblePassageResponse;
    throw new Error(err.message ?? `API.Bible lookup failed (${res.status}).`);
  }

  const data = (await res.json()) as ApiBiblePassageResponse;
  const text = cleanPassageContent(data.data?.content ?? '');
  if (!text) throw new Error('No text returned for that reference.');

  return {
    reference: data.data?.reference ?? parsed.formatted,
    text,
    translation: translationLabel,
  };
}

/** Reset cached catalog (e.g. after key change in dev). */
export function resetApiBibleCatalogCache(): void {
  bibleCatalogPromise = null;
}
