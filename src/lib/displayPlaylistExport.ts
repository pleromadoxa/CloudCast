import type { DisplayFeedState, DisplaySlide } from '../types/displayFeed';

export interface DisplayPlaylistExport {
  version: 1;
  exportedAt: string;
  name: string;
  slides: DisplaySlide[];
  playlist: string[];
}

export function exportDisplayPlaylist(state: DisplayFeedState, name = 'Service Order'): DisplayPlaylistExport {
  const playlistSlides = state.playlist
    .map((id) => state.slides.find((slide) => slide.id === id))
    .filter((slide): slide is DisplaySlide => Boolean(slide));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    name,
    slides: playlistSlides,
    playlist: state.playlist.filter((id) => playlistSlides.some((slide) => slide.id === id)),
  };
}

export function parseDisplayPlaylistExport(raw: unknown): DisplayPlaylistExport | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<DisplayPlaylistExport>;
  if (data.version !== 1 || !Array.isArray(data.slides) || !Array.isArray(data.playlist)) return null;
  if (!data.slides.every((slide) => slide && typeof slide.id === 'string')) return null;
  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    name: typeof data.name === 'string' ? data.name : 'Imported Order',
    slides: data.slides,
    playlist: data.playlist.filter((id) => typeof id === 'string'),
  };
}
