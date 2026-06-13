import { describe, expect, it } from 'vitest';
import { groupLibraryByCategory } from './replayRundownLibrary';
import { digestFrequencyLabel } from './replayOpsDigest';
import { parseArchiveDaysInput, parseDeleteDaysInput } from './replayClipLifecycle';

describe('replayRundownLibrary', () => {
  it('groups library entries by category', () => {
    const grouped = groupLibraryByCategory([
      {
        id: '1',
        sessionId: null,
        name: 'A',
        playbackRate: 1,
        items: [],
        createdAt: '',
        updatedAt: '',
        isLibrary: true,
        libraryCategory: 'Sports',
      },
      {
        id: '2',
        sessionId: null,
        name: 'B',
        playbackRate: 1,
        items: [],
        createdAt: '',
        updatedAt: '',
        isLibrary: true,
        libraryCategory: 'News',
      },
    ]);
    expect(grouped.get('Sports')?.length).toBe(1);
    expect(grouped.get('News')?.length).toBe(1);
  });
});

describe('replayOpsDigest', () => {
  it('labels digest frequencies', () => {
    expect(digestFrequencyLabel('manual')).toBe('Manual only');
    expect(digestFrequencyLabel('weekly')).toBe('Weekly');
  });
});

describe('replayClipLifecycle', () => {
  it('validates archive and delete day inputs', () => {
    expect(parseArchiveDaysInput('30')).toBe(30);
    expect(parseArchiveDaysInput('3')).toBeNull();
    expect(parseDeleteDaysInput('60')).toBe(60);
    expect(parseDeleteDaysInput('10')).toBeNull();
  });
});
