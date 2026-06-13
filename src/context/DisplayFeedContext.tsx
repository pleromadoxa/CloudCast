import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  DisplayBackground,
  DisplayCustomTemplate,
  DisplayFeedState,
  DisplayMediaItem,
  DisplaySlide,
  DisplayTextField,
  ScripturePreset,
} from '../types/displayFeed';
import {
  createDefaultDisplayFeedState,
  createEmptySlide,
  createScriptureSlide,
} from '../types/displayFeed';
import { loadDisplayFeedState, saveDisplayFeedState } from '../lib/displayFeedStorage';
import {
  buildSlideFromCustomTemplate,
  buildSlideFromTemplate,
} from '../lib/displayTemplateUtils';
import { splitLyricsIntoSlides } from '../lib/displayLyrics';

interface DisplayFeedContextValue {
  state: DisplayFeedState;
  previewSlide: DisplaySlide | null;
  liveSlide: DisplaySlide | null;
  isLive: boolean;
  /** Stage a slide in operator preview */
  setPreviewSlide: (id: string) => void;
  /** Push preview slide to Display Feed live output */
  goLive: () => void;
  /** Push preview to live, then advance playlist to next slide */
  takeLiveAndAdvance: () => void;
  /** Clear live output (hold screen) */
  clearLive: () => void;
  /** Add / update / remove slides */
  addSlide: (slide?: Partial<DisplaySlide>) => string;
  updateSlide: (id: string, partial: Partial<DisplaySlide>) => void;
  removeSlide: (id: string) => void;
  duplicateSlide: (id: string) => string;
  /** Playlist navigation */
  nextSlide: () => void;
  prevSlide: () => void;
  goToPlaylistIndex: (index: number) => void;
  addToPlaylist: (slideId: string) => void;
  removeFromPlaylist: (slideId: string) => void;
  reorderPlaylist: (from: number, to: number) => void;
  /** Field editing on preview slide */
  updatePreviewField: (fieldId: string, partial: Partial<DisplayTextField>) => void;
  setPreviewBackground: (bg: DisplayBackground) => void;
  /** Scripture quick-add */
  addScriptureSlide: (reference: string, text: string, translation?: string) => string;
  /** Media library */
  addMedia: (file: File) => Promise<DisplayMediaItem | null>;
  removeMedia: (id: string) => void;
  applyMediaAsBackground: (mediaId: string) => void;
  applyMediaAsForeground: (mediaId: string) => void;
  applyTemplate: (templateId: string) => string;
  applyCustomTemplate: (templateId: string) => string;
  saveCustomTemplate: (template: DisplayCustomTemplate) => void;
  removeCustomTemplate: (id: string) => void;
  saveScripturePreset: (reference: string, text: string, translation: string, translationId?: string) => void;
  removeScripturePreset: (id: string) => void;
  applyScripturePreset: (id: string) => void;
  importLyricsSlides: (lyrics: string, songTitle: string) => string[];
  importPlaylistExport: (slides: DisplaySlide[], playlist: string[]) => void;
  setHoldBackground: (bg: DisplayBackground) => void;
  setKeyMode: (enabled: boolean) => void;
  patchState: (partial: Partial<DisplayFeedState>) => void;
}

const DisplayFeedContext = createContext<DisplayFeedContextValue | null>(null);

function findSlide(state: DisplayFeedState, id: string | null): DisplaySlide | null {
  if (!id) return null;
  return state.slides.find((s) => s.id === id) ?? null;
}

export function DisplayFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DisplayFeedState>(() => loadDisplayFeedState());

  useEffect(() => {
    const t = setTimeout(() => saveDisplayFeedState(state), 300);
    return () => clearTimeout(t);
  }, [state]);

  const previewSlide = useMemo(() => findSlide(state, state.previewSlideId), [state]);
  const liveSlide = useMemo(() => findSlide(state, state.liveSlideId), [state]);
  const isLive = Boolean(state.liveSlideId);

  const setPreviewSlide = useCallback((id: string) => {
    setState((prev) => ({ ...prev, previewSlideId: id }));
  }, []);

  const goLive = useCallback(() => {
    setState((prev) => ({
      ...prev,
      liveSlideId: prev.previewSlideId,
    }));
  }, []);

  const takeLiveAndAdvance = useCallback(() => {
    setState((prev) => {
      const liveSlideId = prev.previewSlideId;
      if (!prev.playlist.length) {
        return { ...prev, liveSlideId };
      }
      const nextIndex = (prev.playlistIndex + 1) % prev.playlist.length;
      return {
        ...prev,
        liveSlideId,
        playlistIndex: nextIndex,
        previewSlideId: prev.playlist[nextIndex],
      };
    });
  }, []);

  const clearLive = useCallback(() => {
    setState((prev) => ({ ...prev, liveSlideId: null }));
  }, []);

  const addSlide = useCallback((partial?: Partial<DisplaySlide>) => {
    const slide = createEmptySlide(partial);
    setState((prev) => ({
      ...prev,
      slides: [...prev.slides, slide],
      previewSlideId: slide.id,
    }));
    return slide.id;
  }, []);

  const updateSlide = useCallback((id: string, partial: Partial<DisplaySlide>) => {
    setState((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === id ? { ...s, ...partial, updatedAt: new Date().toISOString() } : s,
      ),
    }));
  }, []);

  const removeSlide = useCallback((id: string) => {
    setState((prev) => {
      const slides = prev.slides.filter((s) => s.id !== id);
      if (!slides.length) {
        const fallback = createEmptySlide({ title: 'Blank' });
        return {
          ...prev,
          slides: [fallback],
          previewSlideId: fallback.id,
          liveSlideId: prev.liveSlideId === id ? null : prev.liveSlideId,
          playlist: [fallback.id],
          playlistIndex: 0,
        };
      }
      const previewSlideId =
        prev.previewSlideId === id ? slides[0].id : prev.previewSlideId;
      const liveSlideId = prev.liveSlideId === id ? null : prev.liveSlideId;
      const playlist = prev.playlist.filter((pid) => pid !== id);
      const playlistIndex = Math.min(prev.playlistIndex, Math.max(0, playlist.length - 1));
      return { ...prev, slides, previewSlideId, liveSlideId, playlist, playlistIndex };
    });
  }, []);

  const duplicateSlide = useCallback((id: string) => {
    let newId = '';
    setState((prev) => {
      const source = prev.slides.find((s) => s.id === id);
      if (!source) return prev;
      const copy = createEmptySlide({
        ...source,
        title: `${source.title} (copy)`,
        fields: source.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
      });
      newId = copy.id;
      return {
        ...prev,
        slides: [...prev.slides, copy],
        previewSlideId: copy.id,
      };
    });
    return newId;
  }, []);

  const nextSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.playlist.length) return prev;
      const nextIndex = (prev.playlistIndex + 1) % prev.playlist.length;
      const slideId = prev.playlist[nextIndex];
      return { ...prev, playlistIndex: nextIndex, previewSlideId: slideId };
    });
  }, []);

  const prevSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.playlist.length) return prev;
      const nextIndex = (prev.playlistIndex - 1 + prev.playlist.length) % prev.playlist.length;
      const slideId = prev.playlist[nextIndex];
      return { ...prev, playlistIndex: nextIndex, previewSlideId: slideId };
    });
  }, []);

  const goToPlaylistIndex = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.playlist.length) return prev;
      const clamped = Math.max(0, Math.min(index, prev.playlist.length - 1));
      return { ...prev, playlistIndex: clamped, previewSlideId: prev.playlist[clamped] };
    });
  }, []);

  const addToPlaylist = useCallback((slideId: string) => {
    setState((prev) => {
      if (prev.playlist.includes(slideId)) return prev;
      return { ...prev, playlist: [...prev.playlist, slideId] };
    });
  }, []);

  const removeFromPlaylist = useCallback((slideId: string) => {
    setState((prev) => {
      const playlist = prev.playlist.filter((id) => id !== slideId);
      return {
        ...prev,
        playlist,
        playlistIndex: Math.min(prev.playlistIndex, Math.max(0, playlist.length - 1)),
      };
    });
  }, []);

  const reorderPlaylist = useCallback((from: number, to: number) => {
    setState((prev) => {
      const playlist = [...prev.playlist];
      const [item] = playlist.splice(from, 1);
      playlist.splice(to, 0, item);
      const playlistIndex = playlist.indexOf(prev.previewSlideId ?? '');
      return {
        ...prev,
        playlist,
        playlistIndex: playlistIndex >= 0 ? playlistIndex : prev.playlistIndex,
      };
    });
  }, []);

  const updatePreviewField = useCallback((fieldId: string, partial: Partial<DisplayTextField>) => {
    setState((prev) => {
      if (!prev.previewSlideId) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) => {
          if (s.id !== prev.previewSlideId) return s;
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...partial } : f)),
          };
        }),
      };
    });
  }, []);

  const setPreviewBackground = useCallback((bg: DisplayBackground) => {
    setState((prev) => {
      if (!prev.previewSlideId) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === prev.previewSlideId
            ? { ...s, background: bg, updatedAt: new Date().toISOString() }
            : s,
        ),
      };
    });
  }, []);

  const addScriptureSlide = useCallback((reference: string, text: string, translation?: string) => {
    const slide = createScriptureSlide(reference, text, translation);
    setState((prev) => ({
      ...prev,
      slides: [...prev.slides, slide],
      previewSlideId: slide.id,
      playlist: prev.playlist.includes(slide.id) ? prev.playlist : [...prev.playlist, slide.id],
    }));
    return slide.id;
  }, []);

  const addMedia = useCallback(async (file: File): Promise<DisplayMediaItem | null> => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return null;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const item: DisplayMediaItem = {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      addedAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, mediaLibrary: [...prev.mediaLibrary, item] }));
    return item;
  }, []);

  const removeMedia = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      mediaLibrary: prev.mediaLibrary.filter((m) => m.id !== id),
    }));
  }, []);

  const applyMediaAsBackground = useCallback((mediaId: string) => {
    setState((prev) => {
      const media = prev.mediaLibrary.find((m) => m.id === mediaId);
      if (!media || media.type !== 'image' || !prev.previewSlideId) return prev;
      const bg: DisplayBackground = { kind: 'image', imageUrl: media.url, overlayOpacity: 35 };
      return {
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === prev.previewSlideId ? { ...s, background: bg } : s,
        ),
      };
    });
  }, []);

  const applyMediaAsForeground = useCallback((mediaId: string) => {
    setState((prev) => {
      const media = prev.mediaLibrary.find((m) => m.id === mediaId);
      if (!media || media.type !== 'image' || !prev.previewSlideId) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === prev.previewSlideId
            ? { ...s, foregroundImageUrl: media.url, foregroundPosition: 'center', foregroundSize: 'medium' }
            : s,
        ),
      };
    });
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const slide = buildSlideFromTemplate(templateId);
    if (!slide) return '';
    setState((prev) => ({
      ...prev,
      slides: [...prev.slides, slide],
      previewSlideId: slide.id,
      playlist: prev.playlist.includes(slide.id) ? prev.playlist : [...prev.playlist, slide.id],
    }));
    return slide.id;
  }, []);

  const applyCustomTemplate = useCallback((templateId: string) => {
    let newId = '';
    setState((prev) => {
      const custom = prev.customTemplates.find((t) => t.id === templateId);
      if (!custom) return prev;
      const slide = buildSlideFromCustomTemplate(custom);
      newId = slide.id;
      return {
        ...prev,
        slides: [...prev.slides, slide],
        previewSlideId: slide.id,
        playlist: prev.playlist.includes(slide.id) ? prev.playlist : [...prev.playlist, slide.id],
      };
    });
    return newId;
  }, []);

  const saveCustomTemplate = useCallback((template: DisplayCustomTemplate) => {
    setState((prev) => ({
      ...prev,
      customTemplates: [...prev.customTemplates.filter((t) => t.id !== template.id), template],
    }));
  }, []);

  const removeCustomTemplate = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      customTemplates: prev.customTemplates.filter((t) => t.id !== id),
    }));
  }, []);

  const saveScripturePreset = useCallback(
    (reference: string, text: string, translation: string, translationId?: string) => {
      const preset: ScripturePreset = {
        id: crypto.randomUUID(),
        reference,
        text,
        translation,
        translationId,
        savedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        scripturePresets: [preset, ...prev.scripturePresets.filter((p) => p.reference !== reference)],
      }));
    },
    [],
  );

  const removeScripturePreset = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      scripturePresets: prev.scripturePresets.filter((p) => p.id !== id),
    }));
  }, []);

  const applyScripturePreset = useCallback((id: string) => {
    setState((prev) => {
      const preset = prev.scripturePresets.find((p) => p.id === id);
      if (!preset) return prev;
      const slide = createScriptureSlide(preset.reference, preset.text, preset.translation);
      return {
        ...prev,
        slides: [...prev.slides, slide],
        previewSlideId: slide.id,
        playlist: prev.playlist.includes(slide.id) ? prev.playlist : [...prev.playlist, slide.id],
      };
    });
  }, []);

  const importLyricsSlides = useCallback((lyrics: string, songTitle: string) => {
    const slides = splitLyricsIntoSlides(lyrics, songTitle);
    if (!slides.length) return [];
    setState((prev) => ({
      ...prev,
      slides: [...prev.slides, ...slides],
      previewSlideId: slides[0].id,
      playlist: [...prev.playlist, ...slides.map((slide) => slide.id)],
      playlistIndex: prev.playlist.length,
    }));
    return slides.map((slide) => slide.id);
  }, []);

  const importPlaylistExport = useCallback((slides: DisplaySlide[], playlist: string[]) => {
    setState((prev) => {
      const existingIds = new Set(prev.slides.map((slide) => slide.id));
      const remapped = new Map<string, string>();
      const importedSlides = slides.map((slide) => {
        if (!existingIds.has(slide.id)) {
          return slide;
        }
        const copy = createEmptySlide({
          ...slide,
          title: `${slide.title} (imported)`,
          fields: slide.fields.map((field) => ({ ...field, id: crypto.randomUUID() })),
        });
        remapped.set(slide.id, copy.id);
        return copy;
      });

      const importedIds = importedSlides.map((slide) => slide.id);
      const playlistIds = playlist
        .map((id) => remapped.get(id) ?? id)
        .filter((id) => importedIds.includes(id));

      return {
        ...prev,
        slides: [...prev.slides, ...importedSlides],
        previewSlideId: playlistIds[0] ?? importedIds[0] ?? prev.previewSlideId,
        playlist: [...prev.playlist, ...playlistIds],
        playlistIndex: prev.playlist.length,
      };
    });
  }, []);

  const setHoldBackground = useCallback((bg: DisplayBackground) => {
    setState((prev) => ({ ...prev, holdBackground: bg }));
  }, []);

  const setKeyMode = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, keyMode: enabled }));
  }, []);

  const patchState = useCallback((partial: Partial<DisplayFeedState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      previewSlide,
      liveSlide,
      isLive,
      setPreviewSlide,
      goLive,
      takeLiveAndAdvance,
      clearLive,
      addSlide,
      updateSlide,
      removeSlide,
      duplicateSlide,
      nextSlide,
      prevSlide,
      goToPlaylistIndex,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      updatePreviewField,
      setPreviewBackground,
      addScriptureSlide,
      addMedia,
      removeMedia,
      applyMediaAsBackground,
      applyMediaAsForeground,
      applyTemplate,
      applyCustomTemplate,
      saveCustomTemplate,
      removeCustomTemplate,
      saveScripturePreset,
      removeScripturePreset,
      applyScripturePreset,
      importLyricsSlides,
      importPlaylistExport,
      setHoldBackground,
      setKeyMode,
      patchState,
    }),
    [
      state,
      previewSlide,
      liveSlide,
      isLive,
      setPreviewSlide,
      goLive,
      takeLiveAndAdvance,
      clearLive,
      addSlide,
      updateSlide,
      removeSlide,
      duplicateSlide,
      nextSlide,
      prevSlide,
      goToPlaylistIndex,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      updatePreviewField,
      setPreviewBackground,
      addScriptureSlide,
      addMedia,
      removeMedia,
      applyMediaAsBackground,
      applyMediaAsForeground,
      applyTemplate,
      applyCustomTemplate,
      saveCustomTemplate,
      removeCustomTemplate,
      saveScripturePreset,
      removeScripturePreset,
      applyScripturePreset,
      importLyricsSlides,
      importPlaylistExport,
      setHoldBackground,
      setKeyMode,
      patchState,
    ],
  );

  return <DisplayFeedContext.Provider value={value}>{children}</DisplayFeedContext.Provider>;
}

export function useDisplayFeed() {
  const ctx = useContext(DisplayFeedContext);
  if (!ctx) throw new Error('useDisplayFeed must be used within DisplayFeedProvider');
  return ctx;
}

export function useDisplayFeedOptional() {
  return useContext(DisplayFeedContext);
}

/** Reset to defaults — useful for tests */
export function resetDisplayFeedState() {
  saveDisplayFeedState(createDefaultDisplayFeedState());
}
