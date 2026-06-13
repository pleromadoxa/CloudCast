/** Canonical Bible book names and aliases for reference parsing & live search. */

export interface BibleBook {
  id: string;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
  aliases: string[];
}

export const BIBLE_BOOKS: BibleBook[] = [
  { id: 'GEN', name: 'Genesis', testament: 'OT', chapters: 50, aliases: ['gen', 'ge'] },
  { id: 'EXO', name: 'Exodus', testament: 'OT', chapters: 40, aliases: ['exod', 'ex'] },
  { id: 'LEV', name: 'Leviticus', testament: 'OT', chapters: 27, aliases: ['lev', 'le'] },
  { id: 'NUM', name: 'Numbers', testament: 'OT', chapters: 36, aliases: ['num', 'nu'] },
  { id: 'DEU', name: 'Deuteronomy', testament: 'OT', chapters: 34, aliases: ['deut', 'dt'] },
  { id: 'JOS', name: 'Joshua', testament: 'OT', chapters: 24, aliases: ['josh', 'jos'] },
  { id: 'JDG', name: 'Judges', testament: 'OT', chapters: 21, aliases: ['judg', 'jdg'] },
  { id: 'RUT', name: 'Ruth', testament: 'OT', chapters: 4, aliases: ['rut'] },
  { id: '1SA', name: '1 Samuel', testament: 'OT', chapters: 31, aliases: ['1 sam', '1sam', '1 sa'] },
  { id: '2SA', name: '2 Samuel', testament: 'OT', chapters: 24, aliases: ['2 sam', '2sam', '2 sa'] },
  { id: '1KI', name: '1 Kings', testament: 'OT', chapters: 22, aliases: ['1 ki', '1ki', '1 kings'] },
  { id: '2KI', name: '2 Kings', testament: 'OT', chapters: 25, aliases: ['2 ki', '2ki', '2 kings'] },
  { id: '1CH', name: '1 Chronicles', testament: 'OT', chapters: 29, aliases: ['1 ch', '1ch', '1 chron'] },
  { id: '2CH', name: '2 Chronicles', testament: 'OT', chapters: 36, aliases: ['2 ch', '2ch', '2 chron'] },
  { id: 'EZR', name: 'Ezra', testament: 'OT', chapters: 10, aliases: ['ezr'] },
  { id: 'NEH', name: 'Nehemiah', testament: 'OT', chapters: 13, aliases: ['neh'] },
  { id: 'EST', name: 'Esther', testament: 'OT', chapters: 10, aliases: ['est'] },
  { id: 'JOB', name: 'Job', testament: 'OT', chapters: 42, aliases: ['job'] },
  { id: 'PSA', name: 'Psalm', testament: 'OT', chapters: 150, aliases: ['psalms', 'ps', 'psa', 'psalm'] },
  { id: 'PRO', name: 'Proverbs', testament: 'OT', chapters: 31, aliases: ['prov', 'pro'] },
  { id: 'ECC', name: 'Ecclesiastes', testament: 'OT', chapters: 12, aliases: ['eccl', 'ecc'] },
  { id: 'SNG', name: 'Song of Solomon', testament: 'OT', chapters: 8, aliases: ['song', 'sos', 'sng'] },
  { id: 'ISA', name: 'Isaiah', testament: 'OT', chapters: 66, aliases: ['isa'] },
  { id: 'JER', name: 'Jeremiah', testament: 'OT', chapters: 52, aliases: ['jer'] },
  { id: 'LAM', name: 'Lamentations', testament: 'OT', chapters: 5, aliases: ['lam'] },
  { id: 'EZK', name: 'Ezekiel', testament: 'OT', chapters: 48, aliases: ['ezek', 'ezk'] },
  { id: 'DAN', name: 'Daniel', testament: 'OT', chapters: 12, aliases: ['dan'] },
  { id: 'HOS', name: 'Hosea', testament: 'OT', chapters: 14, aliases: ['hos'] },
  { id: 'JOL', name: 'Joel', testament: 'OT', chapters: 3, aliases: ['jol'] },
  { id: 'AMO', name: 'Amos', testament: 'OT', chapters: 9, aliases: ['amo'] },
  { id: 'OBA', name: 'Obadiah', testament: 'OT', chapters: 1, aliases: ['obad', 'oba'] },
  { id: 'JON', name: 'Jonah', testament: 'OT', chapters: 4, aliases: ['jon'] },
  { id: 'MIC', name: 'Micah', testament: 'OT', chapters: 7, aliases: ['mic'] },
  { id: 'NAM', name: 'Nahum', testament: 'OT', chapters: 3, aliases: ['nah', 'nam'] },
  { id: 'HAB', name: 'Habakkuk', testament: 'OT', chapters: 3, aliases: ['hab'] },
  { id: 'ZEP', name: 'Zephaniah', testament: 'OT', chapters: 3, aliases: ['zeph', 'zep'] },
  { id: 'HAG', name: 'Haggai', testament: 'OT', chapters: 2, aliases: ['hag'] },
  { id: 'ZEC', name: 'Zechariah', testament: 'OT', chapters: 14, aliases: ['zech', 'zec'] },
  { id: 'MAL', name: 'Malachi', testament: 'OT', chapters: 4, aliases: ['mal'] },
  { id: 'MAT', name: 'Matthew', testament: 'NT', chapters: 28, aliases: ['matt', 'mat', 'mt'] },
  { id: 'MRK', name: 'Mark', testament: 'NT', chapters: 16, aliases: ['mrk', 'mk'] },
  { id: 'LUK', name: 'Luke', testament: 'NT', chapters: 24, aliases: ['luk', 'lk'] },
  { id: 'JHN', name: 'John', testament: 'NT', chapters: 21, aliases: ['jhn', 'jn'] },
  { id: 'ACT', name: 'Acts', testament: 'NT', chapters: 28, aliases: ['act'] },
  { id: 'ROM', name: 'Romans', testament: 'NT', chapters: 16, aliases: ['rom'] },
  { id: '1CO', name: '1 Corinthians', testament: 'NT', chapters: 16, aliases: ['1 cor', '1cor', '1 co'] },
  { id: '2CO', name: '2 Corinthians', testament: 'NT', chapters: 13, aliases: ['2 cor', '2cor', '2 co'] },
  { id: 'GAL', name: 'Galatians', testament: 'NT', chapters: 6, aliases: ['gal'] },
  { id: 'EPH', name: 'Ephesians', testament: 'NT', chapters: 6, aliases: ['eph'] },
  { id: 'PHP', name: 'Philippians', testament: 'NT', chapters: 4, aliases: ['phil', 'php'] },
  { id: 'COL', name: 'Colossians', testament: 'NT', chapters: 4, aliases: ['col'] },
  { id: '1TH', name: '1 Thessalonians', testament: 'NT', chapters: 5, aliases: ['1 thess', '1th', '1 th'] },
  { id: '2TH', name: '2 Thessalonians', testament: 'NT', chapters: 3, aliases: ['2 thess', '2th', '2 th'] },
  { id: '1TI', name: '1 Timothy', testament: 'NT', chapters: 6, aliases: ['1 tim', '1ti', '1 ti'] },
  { id: '2TI', name: '2 Timothy', testament: 'NT', chapters: 4, aliases: ['2 tim', '2ti', '2 ti'] },
  { id: 'TIT', name: 'Titus', testament: 'NT', chapters: 3, aliases: ['tit'] },
  { id: 'PHM', name: 'Philemon', testament: 'NT', chapters: 1, aliases: ['phlm', 'phm'] },
  { id: 'HEB', name: 'Hebrews', testament: 'NT', chapters: 13, aliases: ['heb'] },
  { id: 'JAS', name: 'James', testament: 'NT', chapters: 5, aliases: ['jas', 'jm'] },
  { id: '1PE', name: '1 Peter', testament: 'NT', chapters: 5, aliases: ['1 pet', '1pe', '1 pe'] },
  { id: '2PE', name: '2 Peter', testament: 'NT', chapters: 3, aliases: ['2 pet', '2pe', '2 pe'] },
  { id: '1JN', name: '1 John', testament: 'NT', chapters: 5, aliases: ['1 jn', '1jn', '1 john'] },
  { id: '2JN', name: '2 John', testament: 'NT', chapters: 1, aliases: ['2 jn', '2jn', '2 john'] },
  { id: '3JN', name: '3 John', testament: 'NT', chapters: 1, aliases: ['3 jn', '3jn', '3 john'] },
  { id: 'JUD', name: 'Jude', testament: 'NT', chapters: 1, aliases: ['jud'] },
  { id: 'REV', name: 'Revelation', testament: 'NT', chapters: 22, aliases: ['rev', 'revelation', 'apocalypse'] },
];

export interface ParsedBibleReference {
  book: BibleBook;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  formatted: string;
}

const BOOK_LOOKUP = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BOOK_LOOKUP.set(book.name.toLowerCase(), book);
  BOOK_LOOKUP.set(book.id.toLowerCase(), book);
  for (const alias of book.aliases) {
    BOOK_LOOKUP.set(alias.toLowerCase(), book);
  }
}

/** Parse "John 3:16", "Psalm 23:1-3", "1 Cor 13:4-7" */
export function parseBibleReference(input: string): ParsedBibleReference | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d?\s?[a-zA-Z.]+(?:\s+[a-zA-Z.]+)?)\s+(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?$/,
  );
  if (!match) return null;

  const bookKey = match[1].replace(/\./g, '').trim().toLowerCase();
  const book = BOOK_LOOKUP.get(bookKey);
  if (!book) return null;

  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : verseStart;

  if (chapter < 1 || chapter > book.chapters || verseStart < 1 || verseEnd < verseStart) {
    return null;
  }

  const versePart = verseEnd > verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
  return {
    book,
    chapter,
    verseStart,
    verseEnd,
    formatted: `${book.name} ${chapter}:${versePart}`,
  };
}

export interface BibleSearchSuggestion {
  type: 'book' | 'reference';
  label: string;
  insertText: string;
}

/** Live search suggestions as the operator types. */
export function searchBibleReferences(query: string, limit = 12): BibleSearchSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const parsed = parseBibleReference(query);
  if (parsed) {
    return [{ type: 'reference', label: parsed.formatted, insertText: parsed.formatted }];
  }

  const partialRef = q.match(/^(.+?)\s+(\d+)(?::(\d*))?$/);
  if (partialRef) {
    const bookPart = partialRef[1].replace(/\./g, '').trim();
    const book = BOOK_LOOKUP.get(bookPart);
    const chapter = Number(partialRef[2]);
    if (book && chapter >= 1 && chapter <= book.chapters) {
      const suggestions: BibleSearchSuggestion[] = [];
      if (partialRef[3] === undefined || partialRef[3] === '') {
        suggestions.push({
          type: 'reference',
          label: `${book.name} ${chapter}:1`,
          insertText: `${book.name} ${chapter}:1`,
        });
      }
      return suggestions;
    }
  }

  const results: BibleSearchSuggestion[] = [];
  for (const book of BIBLE_BOOKS) {
    const haystack = [book.name, ...book.aliases, book.id].join(' ').toLowerCase();
    if (haystack.includes(q) || book.name.toLowerCase().startsWith(q)) {
      results.push({
        type: 'book',
        label: book.name,
        insertText: `${book.name} 1:1`,
      });
    }
    if (results.length >= limit) break;
  }
  return results.slice(0, limit);
}
