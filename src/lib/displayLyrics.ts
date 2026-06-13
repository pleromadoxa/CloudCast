import type { DisplaySlide } from '../types/displayFeed';
import { createEmptySlide } from '../types/displayFeed';

/** Split pasted lyrics into one slide per stanza (blank-line separated). */
export function splitLyricsIntoSlides(lyrics: string, songTitle: string): DisplaySlide[] {
  const title = songTitle.trim() || 'Lyrics';
  const stanzas = lyrics
    .split(/\n\s*\n/)
    .map((stanza) => stanza.trim())
    .filter(Boolean);

  if (!stanzas.length) {
    const lines = lyrics
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    return [
      createEmptySlide({
        title,
        type: 'lyrics',
        fields: [
          { id: 'field-0', label: 'Title', value: title, visible: true, size: 'lg', align: 'center' },
          { id: 'field-1', label: 'Subtitle', value: '', visible: false, size: 'md', align: 'center' },
          { id: 'field-2', label: 'Body', value: lines.join('\n'), visible: true, size: 'xl', align: 'center' },
          { id: 'field-3', label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
        ],
      }),
    ];
  }

  return stanzas.map((stanza, index) =>
    createEmptySlide({
      title: stanzas.length > 1 ? `${title} (${index + 1})` : title,
      type: 'lyrics',
      fields: [
        {
          id: 'field-0',
          label: 'Title',
          value: title,
          visible: index === 0,
          size: 'lg',
          align: 'center',
        },
        { id: 'field-1', label: 'Subtitle', value: '', visible: false, size: 'md', align: 'center' },
        { id: 'field-2', label: 'Body', value: stanza, visible: true, size: 'xl', align: 'center' },
        { id: 'field-3', label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
      ],
    }),
  );
}
