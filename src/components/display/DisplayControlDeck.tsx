import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  ListOrdered,
  Loader2,
  Monitor,
  Music2,
  Palette,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  Upload,
  Download,
  X,
} from 'lucide-react';
import { useDisplayFeed } from '../../context/DisplayFeedContext';
import type { DisplayPanel, DisplaySlideLayout, DisplaySlideType } from '../../types/displayFeed';
import { DISPLAY_BACKGROUND_PRESETS } from '../../lib/displayBackgrounds';
import {
  ALL_DISPLAY_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from '../../lib/displayTemplateUtils';
import {
  BIBLE_TRANSLATIONS,
  isApiBibleConfigured,
  lookupScripture,
  parseBibleReference,
  searchBibleReferences,
  type BibleTranslationId,
  type BibleSearchSuggestion,
} from '../../lib/bibleApi';
import { customTemplateFromPartial, customTemplateFromPreviewSlide } from '../../lib/displayTemplateUtils';
import { FOREGROUND_POSITION_PRESETS } from '../../lib/displayForegroundPosition';
import { exportDisplayPlaylist, parseDisplayPlaylistExport } from '../../lib/displayPlaylistExport';
import { inferDisplayForegroundSize, loadImageDimensions } from '../../lib/mediaImagePlacement';
import { cn } from '../../lib/utils';

const PANELS: { id: DisplayPanel; icon: typeof Type; label: string }[] = [
  { id: 'slides', icon: Layers, label: 'Slides' },
  { id: 'templates', icon: LayoutTemplate, label: 'Templates' },
  { id: 'fields', icon: Type, label: 'Fields' },
  { id: 'scripture', icon: BookOpen, label: 'Scripture' },
  { id: 'lyrics', icon: Music2, label: 'Lyrics' },
  { id: 'backgrounds', icon: Palette, label: 'Backgrounds' },
  { id: 'media', icon: ImageIcon, label: 'Media' },
  { id: 'playlist', icon: ListOrdered, label: 'Order' },
];

const SLIDE_TYPES: { id: DisplaySlideType; label: string }[] = [
  { id: 'custom', label: 'Custom' },
  { id: 'scripture', label: 'Scripture' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'media', label: 'Media' },
  { id: 'overlay', label: 'Overlay (key)' },
  { id: 'blank', label: 'Blank' },
];

/** Sample scripture passages for quick insert */
const SAMPLE_SCRIPTURES = [
  {
    ref: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    translation: 'NIV',
  },
  {
    ref: 'Psalm 23:1',
    text: 'The Lord is my shepherd, I lack nothing.',
    translation: 'NIV',
  },
  {
    ref: 'Philippians 4:13',
    text: 'I can do all this through him who gives me strength.',
    translation: 'NIV',
  },
  {
    ref: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.',
    translation: 'NIV',
  },
];

export function DisplayControlDeck() {
  const feed = useDisplayFeed();
  const [panel, setPanel] = useState<DisplayPanel>('slides');
  const [scriptureRef, setScriptureRef] = useState('');
  const [scriptureText, setScriptureText] = useState('');
  const [scriptureTranslation, setScriptureTranslation] = useState('WEB');
  const [bibleTranslation, setBibleTranslation] = useState<BibleTranslationId>(
    (feed.state.defaultBibleTranslation as BibleTranslationId) ?? 'web',
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<BibleSearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateDesc, setCustomTemplateDesc] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const playlistImportRef = useRef<HTMLInputElement>(null);
  const lookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptureInputRef = useRef<HTMLInputElement>(null);
  const [lyricsTitle, setLyricsTitle] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [slideSaveName, setSlideSaveName] = useState('');
  const [fieldImagePickerId, setFieldImagePickerId] = useState<string | null>(null);
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const [showOverlayPicker, setShowOverlayPicker] = useState(false);
  const overlayImageInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return ALL_DISPLAY_TEMPLATES.filter((t) => {
      if (templateCategory !== 'all' && t.category !== templateCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [templateCategory, templateSearch]);

  const handleBibleLookup = useCallback(async (refOverride?: string) => {
    const ref = (refOverride ?? scriptureRef).trim();
    if (!ref) return;
    setLookupLoading(true);
    setLookupError(null);
    setShowSuggestions(false);
    try {
      const result = await lookupScripture(ref, bibleTranslation);
      setScriptureRef(result.reference);
      setScriptureText(result.text);
      setScriptureTranslation(result.translation);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }, [scriptureRef, bibleTranslation]);

  const handleScriptureRefChange = useCallback(
    (value: string) => {
      setScriptureRef(value);
      setSearchSuggestions(searchBibleReferences(value));
      setShowSuggestions(value.trim().length > 0);

      if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
      const parsed = parseBibleReference(value);
      if (parsed) {
        lookupDebounceRef.current = setTimeout(() => {
          void handleBibleLookup(value);
        }, 600);
      }
    },
    [handleBibleLookup],
  );

  useEffect(() => {
    return () => {
      if (lookupDebounceRef.current) clearTimeout(lookupDebounceRef.current);
    };
  }, []);

  const applySuggestion = useCallback(
    (suggestion: BibleSearchSuggestion) => {
      setScriptureRef(suggestion.insertText);
      setShowSuggestions(false);
      setSearchSuggestions([]);
      void handleBibleLookup(suggestion.insertText);
    },
    [handleBibleLookup],
  );

  const saveCurrentAsPreset = useCallback(() => {
    if (!scriptureRef.trim() || !scriptureText.trim()) return;
    feed.saveScripturePreset(
      scriptureRef.trim(),
      scriptureText.trim(),
      scriptureTranslation.trim(),
      bibleTranslation,
    );
  }, [feed, scriptureRef, scriptureText, scriptureTranslation, bibleTranslation]);

  const handleSaveCustomTemplate = useCallback(() => {
    if (!customTemplateName.trim()) return;
    if (feed.previewSlide) {
      const tpl = customTemplateFromPreviewSlide(feed.previewSlide, customTemplateName.trim(), customTemplateDesc.trim());
      if (customImageUrl) tpl.foregroundImageUrl = customImageUrl;
      feed.saveCustomTemplate(tpl);
    } else {
      const tpl = customTemplateFromPartial({
        name: customTemplateName.trim(),
        description: customTemplateDesc.trim(),
        category: 'custom',
        type: 'custom',
        layout: 'banner-bottom',
        bannerHeight: 30,
        background: { kind: 'preset', presetId: 'worship-deep-blue', overlayOpacity: 45 },
        foregroundImageUrl: customImageUrl || undefined,
        foregroundPosition: 'bottom',
        foregroundSize: 'medium',
        fields: [
          { label: 'Title', value: customTemplateName.trim(), visible: true, size: 'lg', align: 'center' },
          { label: 'Subtitle', value: '', visible: false, size: 'md', align: 'center' },
          { label: 'Body', value: customTemplateDesc.trim(), visible: true, size: 'md', align: 'center' },
          { label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
        ],
      });
      feed.saveCustomTemplate(tpl);
    }
    setShowCustomBuilder(false);
    setCustomTemplateName('');
    setCustomTemplateDesc('');
    setCustomImageUrl('');
  }, [feed, customTemplateName, customTemplateDesc, customImageUrl]);

  const handleCustomImageUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setCustomImageUrl(url);
    e.target.value = '';
  }, []);

  const handleMediaUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      for (const file of Array.from(files)) {
        await feed.addMedia(file);
      }
      e.target.value = '';
    },
    [feed],
  );

  const handleMediaDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setMediaDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      );
      for (const file of files) {
        await feed.addMedia(file);
      }
    },
    [feed],
  );

  const toggleVideoPreview = useCallback((id: string) => {
    const el = videoPreviewRefs.current[id];
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const handleExportPlaylist = useCallback(() => {
    const payload = exportDisplayPlaylist(feed.state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `regal-display-order-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [feed.state]);

  const handleImportPlaylist = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = parseDisplayPlaylistExport(JSON.parse(await file.text()));
        if (!parsed) return;
        feed.importPlaylistExport(parsed.slides, parsed.playlist);
      } catch {
        /* invalid file */
      } finally {
        e.target.value = '';
      }
    },
    [feed],
  );

  const handleOverlayImageUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file?.type.startsWith('image/')) return;
      const item = await feed.addMedia(file);
      if (item) {
        const dims = await loadImageDimensions(item.url);
        feed.addOverlaySlide(item.url, item.name, dims);
        setShowOverlayPicker(false);
      }
      e.target.value = '';
    },
    [feed],
  );

  const applyOverlayImageFromLibrary = useCallback(
    async (url: string, name: string) => {
      const dims = await loadImageDimensions(url);
      feed.addOverlaySlide(url, name, dims);
      setShowOverlayPicker(false);
    },
    [feed],
  );

  const applyForegroundImageFromLibrary = useCallback(
    async (slideId: string, url: string) => {
      const dims = await loadImageDimensions(url);
      const size = inferDisplayForegroundSize(dims.width, dims.height);
      feed.updateSlide(slideId, {
        foregroundImageUrl: url,
        foregroundX: 50,
        foregroundY: 50,
        foregroundWidthPct: size.widthPct,
        foregroundHeightPct: size.heightPct,
      });
    },
    [feed],
  );

  const previewSlide = feed.previewSlide;
  const isPreviewOverlay = previewSlide?.type === 'overlay' || previewSlide?.background.kind === 'chroma';

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-mixer-border bg-[#0d0d0d]">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-mixer-border/60 px-2 py-1.5">
        {PANELS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-bold tracking-wider',
              panel === id
                ? 'bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/50'
                : 'text-mixer-muted hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {panel === 'slides' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wider text-mixer-muted">ALL SLIDES</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => feed.addSlide()}
                  className="flex items-center gap-1 rounded bg-violet-600/20 px-2 py-1 text-[10px] font-bold text-violet-200 hover:bg-violet-600/40"
                >
                  <Plus className="h-3 w-3" /> NEW
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverlayPicker((v) => !v)}
                  className="flex items-center gap-1 rounded bg-emerald-600/20 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-600/40"
                >
                  <Layers className="h-3 w-3" /> ADD OVERLAY
                </button>
              </div>
            </div>
            {showOverlayPicker && (
              <div className="space-y-2 rounded border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                <p className="text-[10px] font-bold tracking-wider text-emerald-300">TRANSPARENT OVERLAY SLIDE</p>
                <p className="text-[9px] leading-snug text-mixer-muted">
                  Green areas key out in the video mixer — your image floats over the live camera feed.
                  KEY mode turns on automatically.
                </p>
                <input
                  ref={overlayImageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void handleOverlayImageUpload(e)}
                />
                <button
                  type="button"
                  onClick={() => overlayImageInputRef.current?.click()}
                  className="w-full rounded border border-dashed border-emerald-500/40 py-2 text-[9px] font-bold tracking-wider text-emerald-200 hover:bg-emerald-950/40"
                >
                  UPLOAD PNG / IMAGE
                </button>
                {feed.state.mediaLibrary.filter((m) => m.type === 'image').length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {feed.state.mediaLibrary
                      .filter((m) => m.type === 'image')
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void applyOverlayImageFromLibrary(item.url, item.name)}
                          className="overflow-hidden rounded border border-mixer-border hover:border-emerald-500/50"
                        >
                          <img src={item.url} alt={item.name} className="aspect-video w-full object-contain bg-[#0a0a0a]" />
                        </button>
                      ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    feed.addOverlaySlide();
                    setShowOverlayPicker(false);
                  }}
                  className="w-full rounded bg-white/5 py-1.5 text-[9px] font-bold text-mixer-muted hover:text-white"
                >
                  Blank overlay (add image in Fields)
                </button>
              </div>
            )}
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {feed.state.slides.map((slide) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => feed.setPreviewSlide(slide.id)}
                  onDoubleClick={() => {
                    feed.setPreviewSlide(slide.id);
                    feed.goLive();
                  }}
                  className={cn(
                    'group relative rounded border p-2 text-left transition-colors',
                    feed.state.previewSlideId === slide.id
                      ? 'border-violet-500/60 bg-violet-950/40 ring-1 ring-violet-500/40'
                      : 'border-mixer-border bg-mixer-surface hover:border-violet-500/30',
                    feed.state.liveSlideId === slide.id && 'ring-1 ring-emerald-500/50',
                  )}
                >
                  <p className="truncate text-xs font-semibold text-white">{slide.title}</p>
                  <p className="text-[9px] uppercase tracking-wider text-mixer-muted">{slide.type}</p>
                  {slide.type === 'overlay' && (
                    <span className="mt-0.5 inline-block rounded bg-emerald-600/30 px-1 py-0.5 text-[7px] font-bold text-emerald-200">
                      KEY OVERLAY
                    </span>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        feed.setPreviewSlide(slide.id);
                      }}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
                        feed.state.previewSlideId === slide.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-white/10 text-mixer-muted hover:text-white',
                      )}
                    >
                      PREVIEW
                    </button>
                    {slide.videoUrl && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold text-violet-200">
                        VIDEO
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[8px] text-mixer-muted/70">Double-click to go live</p>
                  {feed.state.liveSlideId === slide.id && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-emerald-600/80 px-1 py-0.5 text-[8px] font-bold text-white">
                      LIVE
                    </span>
                  )}
                  <div className="mt-1 flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        feed.duplicateSlide(slide.id);
                      }}
                      className="rounded p-0.5 hover:bg-white/10"
                      title="Duplicate"
                    >
                      <Copy className="h-3 w-3 text-mixer-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        feed.removeSlide(slide.id);
                      }}
                      className="rounded p-0.5 hover:bg-red-500/20"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-mixer-red" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {panel === 'templates' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-mixer-muted" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="w-full rounded border border-mixer-border bg-black/40 py-1.5 pl-7 pr-2 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCustomBuilder((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded bg-violet-600/30 px-2 py-1.5 text-[9px] font-bold text-violet-100 hover:bg-violet-600/50"
              >
                <Plus className="h-3 w-3" /> CUSTOM
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategory(cat)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                    templateCategory === cat
                      ? 'bg-violet-600/40 text-violet-100 ring-1 ring-violet-500/40'
                      : 'bg-white/5 text-mixer-muted hover:text-white',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {showCustomBuilder && (
              <div className="space-y-2 rounded border border-violet-500/40 bg-violet-950/30 p-2.5">
                <p className="text-[10px] font-bold tracking-wider text-violet-300">CREATE CUSTOM TEMPLATE</p>
                <input
                  type="text"
                  value={customTemplateName}
                  onChange={(e) => setCustomTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={customTemplateDesc}
                  onChange={(e) => setCustomTemplateDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-xs text-white"
                />
                <input ref={customImageInputRef} type="file" accept="image/*" hidden onChange={handleCustomImageUpload} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => customImageInputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed border-violet-500/40 py-2 text-[9px] font-bold text-violet-200"
                  >
                    <ImageIcon className="h-3 w-3" /> {customImageUrl ? 'CHANGE IMAGE' : 'IMPORT IMAGE'}
                  </button>
                  {customImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomImageUrl('')}
                      className="rounded px-2 py-1 text-[9px] text-mixer-muted hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {customImageUrl && (
                  <img src={customImageUrl} alt="" className="max-h-20 w-full rounded object-contain bg-black/40" />
                )}
                <p className="text-[9px] text-mixer-muted">
                  Saves from current preview slide, or creates a banner template with your image.
                </p>
                <button
                  type="button"
                  disabled={!customTemplateName.trim()}
                  onClick={handleSaveCustomTemplate}
                  className="flex w-full items-center justify-center gap-1 rounded bg-violet-600 py-2 text-[10px] font-bold text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" /> SAVE TEMPLATE
                </button>
              </div>
            )}

            {feed.state.customTemplates.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold tracking-wider text-emerald-400">YOUR TEMPLATES</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {feed.state.customTemplates.map((custom) => (
                    <div
                      key={custom.id}
                      className="group relative rounded border border-emerald-500/30 bg-emerald-950/20 p-2 text-left"
                    >
                      {custom.foregroundImageUrl && (
                        <img
                          src={custom.foregroundImageUrl}
                          alt=""
                          className="mb-1.5 aspect-video w-full rounded object-cover"
                        />
                      )}
                      <p className="text-xs font-semibold text-white">{custom.name}</p>
                      <p className="text-[9px] text-mixer-muted">{custom.description ?? 'Custom template'}</p>
                      <div className="mt-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() => feed.applyCustomTemplate(custom.id)}
                          className="flex-1 rounded bg-emerald-600/40 py-1 text-[8px] font-bold text-emerald-100 hover:bg-emerald-600/60"
                        >
                          USE
                        </button>
                        <button
                          type="button"
                          onClick={() => feed.removeCustomTemplate(custom.id)}
                          className="rounded p-1 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3 w-3 text-mixer-red" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-mixer-muted">
              {filteredTemplates.length} templates — click to add to preview. Use Info Banner templates with KEY mode for mixer overlays.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => feed.applyTemplate(template.id)}
                  className="group rounded border border-mixer-border bg-mixer-surface/40 p-2.5 text-left hover:border-violet-500/50 hover:bg-violet-950/20"
                >
                  <div className="mb-2 aspect-video w-full overflow-hidden rounded">
                    {template.background?.presetId ? (
                      <div
                        className="h-full w-full"
                        style={{
                          background: DISPLAY_BACKGROUND_PRESETS.find(
                            (p) => p.id === template.background?.presetId,
                          )?.preview,
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-end bg-[#1e293b]">
                        {(template.layout === 'banner-bottom' || template.layout === 'lower-third') && (
                          <div
                            className="w-full"
                            style={{
                              height: `${template.bannerHeight ?? 30}%`,
                              background: DISPLAY_BACKGROUND_PRESETS.find(
                                (p) => p.id === template.background?.presetId,
                              )?.preview ?? 'linear-gradient(135deg, #334155, #0f172a)',
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white">{template.name}</p>
                  <p className="text-[9px] text-mixer-muted">{template.description}</p>
                  <span className="mt-1 inline-block text-[8px] uppercase tracking-wider text-violet-400/80">
                    {template.category}
                    {template.layout === 'banner-bottom' && ' · banner'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {panel === 'fields' && previewSlide && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={previewSlide.title}
                onChange={(e) => feed.updateSlide(previewSlide.id, { title: e.target.value })}
                className="flex-1 rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
                placeholder="Slide title"
              />
              <select
                value={previewSlide.type}
                onChange={(e) =>
                  feed.updateSlide(previewSlide.id, { type: e.target.value as DisplaySlideType })
                }
                className="rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-[10px] font-bold text-white"
              >
                {SLIDE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">LAYOUT</label>
                <select
                  value={previewSlide.layout ?? 'full'}
                  onChange={(e) =>
                    feed.updateSlide(previewSlide.id, { layout: e.target.value as DisplaySlideLayout })
                  }
                  className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-[10px] font-bold text-white"
                >
                  <option value="full">Full screen</option>
                  <option value="banner-bottom">Banner bottom</option>
                  <option value="banner-top">Banner top</option>
                  <option value="lower-third">Lower third</option>
                </select>
              </div>
              {(previewSlide.layout === 'banner-bottom' ||
                previewSlide.layout === 'banner-top' ||
                previewSlide.layout === 'lower-third') && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">
                    BANNER HEIGHT ({previewSlide.bannerHeight ?? 30}%)
                  </label>
                  <input
                    type="range"
                    min={15}
                    max={45}
                    value={previewSlide.bannerHeight ?? 30}
                    onChange={(e) =>
                      feed.updateSlide(previewSlide.id, { bannerHeight: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
            {isPreviewOverlay && (
              <div className="rounded border border-emerald-500/40 bg-emerald-950/25 p-2.5">
                <p className="mb-1 text-[10px] font-bold tracking-wider text-emerald-300">MIXER OVERLAY</p>
                <p className="mb-2 text-[9px] leading-snug text-mixer-muted">
                  Green = transparent over cameras when KEY is on. Position and size your PNG below, then GO LIVE + CUT TO PGM.
                </p>
                {!previewSlide.foregroundImageUrl && (
                  <div className="mb-2 grid grid-cols-3 gap-1.5">
                    {feed.state.mediaLibrary
                      .filter((m) => m.type === 'image')
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void applyForegroundImageFromLibrary(previewSlide.id, item.url)}
                          className="overflow-hidden rounded border border-mixer-border hover:border-emerald-500/50"
                        >
                          <img src={item.url} alt={item.name} className="aspect-video w-full object-contain bg-black" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            {(previewSlide.foregroundImageUrl || isPreviewOverlay) && (
              <div className="rounded border border-violet-500/30 bg-violet-950/20 p-2.5">
                <p className="mb-2 text-[10px] font-bold tracking-wider text-violet-300">IMAGE ON SLIDE</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {(Object.keys(FOREGROUND_POSITION_PRESETS) as Array<keyof typeof FOREGROUND_POSITION_PRESETS>).map(
                    (key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const preset = FOREGROUND_POSITION_PRESETS[key];
                          feed.updateSlide(previewSlide.id, {
                            foregroundPosition: key,
                            foregroundX: preset.x,
                            foregroundY: preset.y,
                          });
                        }}
                        className={cn(
                          'rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                          previewSlide.foregroundPosition === key
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/10 text-mixer-muted hover:text-white',
                        )}
                      >
                        {FOREGROUND_POSITION_PRESETS[key].label}
                      </button>
                    ),
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[9px] text-mixer-muted">
                    Width ({previewSlide.foregroundWidthPct ?? 35}% of screen)
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={previewSlide.foregroundWidthPct ?? 35}
                      onChange={(e) =>
                        feed.updateSlide(previewSlide.id, { foregroundWidthPct: Number(e.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-[9px] text-mixer-muted">
                    Height ({previewSlide.foregroundHeightPct ?? 'auto'}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={previewSlide.foregroundHeightPct ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        feed.updateSlide(previewSlide.id, {
                          foregroundHeightPct: v > 0 ? v : undefined,
                        });
                      }}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-[9px] text-mixer-muted sm:col-span-1">
                    Horizontal ({previewSlide.foregroundX ?? 50}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={previewSlide.foregroundX ?? 50}
                      onChange={(e) =>
                        feed.updateSlide(previewSlide.id, { foregroundX: Number(e.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-[9px] text-mixer-muted">
                    Vertical ({previewSlide.foregroundY ?? 50}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={previewSlide.foregroundY ?? 50}
                      onChange={(e) =>
                        feed.updateSlide(previewSlide.id, { foregroundY: Number(e.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                </div>
                <select
                  value={previewSlide.foregroundSize ?? 'medium'}
                  onChange={(e) =>
                    feed.updateSlide(previewSlide.id, {
                      foregroundSize: e.target.value as NonNullable<typeof previewSlide.foregroundSize>,
                    })
                  }
                  className="mt-2 w-full rounded border border-mixer-border/60 bg-black/30 px-2 py-1 text-[9px] text-white"
                >
                  <option value="small">Small overlay</option>
                  <option value="medium">Medium overlay</option>
                  <option value="large">Large overlay</option>
                </select>
              </div>
            )}
            {previewSlide.videoUrl && (
              <div className="rounded border border-mixer-border bg-mixer-surface/50 p-2">
                <p className="mb-1 text-[10px] font-bold tracking-wider text-mixer-muted">VIDEO SLIDE</p>
                <p className="text-[9px] text-mixer-muted">
                  Video plays automatically in preview and live output when this slide is shown.
                </p>
              </div>
            )}
            {previewSlide.fields.map((field) => (
              <div key={field.id} className="rounded border border-mixer-border bg-mixer-surface/50 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-mixer-muted">{field.label}</span>
                  <label className="flex items-center gap-1 text-[9px] text-mixer-muted">
                    <input
                      type="checkbox"
                      checked={field.visible}
                      onChange={(e) => feed.updatePreviewField(field.id, { visible: e.target.checked })}
                      className="rounded"
                    />
                    Visible
                  </label>
                </div>
                <textarea
                  value={field.value}
                  onChange={(e) => feed.updatePreviewField(field.id, { value: e.target.value })}
                  rows={field.label === 'Body' || field.label === 'Scripture' ? 4 : 2}
                  className="w-full resize-y rounded border border-mixer-border/60 bg-black/30 px-2 py-1.5 text-sm text-white"
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                />
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <select
                    value={field.size}
                    onChange={(e) =>
                      feed.updatePreviewField(field.id, {
                        size: e.target.value as typeof field.size,
                      })
                    }
                    className="rounded border border-mixer-border/60 bg-black/30 px-1.5 py-0.5 text-[9px] text-white"
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                    <option value="xl">Extra Large</option>
                    <option value="2xl">Hero</option>
                  </select>
                  <select
                    value={field.align}
                    onChange={(e) =>
                      feed.updatePreviewField(field.id, {
                        align: e.target.value as typeof field.align,
                      })
                    }
                    className="rounded border border-mixer-border/60 bg-black/30 px-1.5 py-0.5 text-[9px] text-white"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFieldImagePickerId(fieldImagePickerId === field.id ? null : field.id)}
                    className="rounded border border-mixer-border/60 bg-black/30 px-2 py-0.5 text-[9px] font-bold text-violet-200 hover:bg-violet-950/40"
                  >
                    {field.imageUrl ? 'Change image' : 'Add image from media'}
                  </button>
                  {field.imageUrl && (
                    <button
                      type="button"
                      onClick={() => feed.updatePreviewField(field.id, { imageUrl: undefined })}
                      className="rounded border border-red-500/30 px-2 py-0.5 text-[9px] text-red-300"
                    >
                      Remove image
                    </button>
                  )}
                </div>
                {fieldImagePickerId === field.id && feed.state.mediaLibrary.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {feed.state.mediaLibrary
                      .filter((m) => m.type === 'image')
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            feed.updatePreviewField(field.id, { imageUrl: item.url, visible: true });
                            setFieldImagePickerId(null);
                          }}
                          className="overflow-hidden rounded border border-mixer-border hover:border-violet-500/50"
                        >
                          <img src={item.url} alt={item.name} className="aspect-video w-full object-cover" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
            <div className="rounded border border-violet-500/30 bg-violet-950/20 p-2.5">
              <p className="mb-2 text-[10px] font-bold tracking-wider text-violet-300">SAVE FOR LATER</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slideSaveName}
                  onChange={(e) => setSlideSaveName(e.target.value)}
                  placeholder={previewSlide.title}
                  className="min-w-0 flex-1 rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    feed.savePreviewSlideTemplate(slideSaveName || previewSlide.title);
                    setSlideSaveName('');
                  }}
                  className="flex shrink-0 items-center gap-1 rounded bg-violet-600/40 px-2 py-1.5 text-[9px] font-bold text-violet-100 hover:bg-violet-600/60"
                >
                  <Save className="h-3 w-3" /> SAVE SLIDE
                </button>
              </div>
              <p className="mt-1 text-[8px] text-mixer-muted">Saved slides appear in Templates → Custom.</p>
            </div>
            {previewSlide.notes !== undefined && (
              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">
                  OPERATOR NOTES (preview only)
                </label>
                <textarea
                  value={previewSlide.notes ?? ''}
                  onChange={(e) => feed.updateSlide(previewSlide.id, { notes: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-mixer-border/60 bg-black/30 px-2 py-1.5 text-xs text-mixer-muted"
                  placeholder="Notes visible only to operator…"
                />
              </div>
            )}
          </div>
        )}

        {panel === 'scripture' && (
          <div className="space-y-3">
            <p className="text-[10px] text-mixer-muted">
              Live search as you type — pick a translation, then add to preview or save for quick lookup.
            </p>
            <div className="space-y-2 rounded border border-violet-500/30 bg-violet-950/20 p-2.5">
              <p className="text-[10px] font-bold tracking-wider text-violet-300">BIBLE LOOKUP</p>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    ref={scriptureInputRef}
                    type="text"
                    value={scriptureRef}
                    onChange={(e) => handleScriptureRefChange(e.target.value)}
                    onFocus={() => setShowSuggestions(scriptureRef.trim().length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleBibleLookup();
                      if (e.key === 'ArrowDown' && searchSuggestions[0]) {
                        e.preventDefault();
                        applySuggestion(searchSuggestions[0]);
                      }
                    }}
                    placeholder="Start typing: John, Psalm 23, John 3:16…"
                    className="min-w-0 flex-1 rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
                  />
                  <select
                    value={bibleTranslation}
                    onChange={(e) => {
                      const id = e.target.value as BibleTranslationId;
                      setBibleTranslation(id);
                      feed.patchState({ defaultBibleTranslation: id });
                    }}
                    className="max-w-[120px] rounded border border-mixer-border bg-black/40 px-1 py-1.5 text-[9px] text-white"
                  >
                    <optgroup label="Popular">
                      {BIBLE_TRANSLATIONS.filter((t) => t.group === 'popular').map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.shortLabel}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Classic">
                      {BIBLE_TRANSLATIONS.filter((t) => t.group === 'classic').map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.shortLabel}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Modern">
                      {BIBLE_TRANSLATIONS.filter((t) => t.group === 'modern').map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.shortLabel}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Licensed (API.Bible)">
                      {BIBLE_TRANSLATIONS.filter((t) => t.group === 'licensed').map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.shortLabel}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded border border-violet-500/40 bg-[#111] shadow-lg">
                    {searchSuggestions.map((s) => (
                      <button
                        key={`${s.type}-${s.label}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySuggestion(s)}
                        className="block w-full px-2 py-1.5 text-left text-xs text-white hover:bg-violet-600/30"
                      >
                        <span className="text-[9px] uppercase text-violet-400">{s.type}</span>{' '}
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!scriptureRef.trim() || lookupLoading}
                onClick={() => void handleBibleLookup()}
                className="flex w-full items-center justify-center gap-2 rounded bg-violet-600 py-2 text-[10px] font-bold tracking-wider text-white hover:bg-violet-500 disabled:opacity-40"
              >
                {lookupLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {lookupLoading ? 'LOOKING UP…' : 'LOOK UP PASSAGE'}
              </button>
              {lookupError && <p className="text-[10px] text-mixer-red">{lookupError}</p>}
              {isApiBibleConfigured() ? (
                <p className="text-[9px] text-emerald-400/90">API.Bible connected — licensed translations enabled.</p>
              ) : (
                <p className="text-[9px] text-mixer-muted">
                  Add VITE_API_BIBLE_KEY to .env for NKJV, NIV, MSG, Passion, etc.
                </p>
              )}
            </div>

            {feed.state.scripturePresets.length > 0 && (
              <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                <p className="mb-2 flex items-center gap-1 text-[10px] font-bold tracking-wider text-emerald-300">
                  <Bookmark className="h-3 w-3" /> QUICK LOOKUP
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {feed.state.scripturePresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-start gap-1 rounded border border-mixer-border/40 bg-black/30 p-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => feed.applyScripturePreset(preset.id)}
                        className="min-w-0 flex-1 text-left hover:text-emerald-200"
                      >
                        <span className="text-xs font-semibold text-white">{preset.reference}</span>
                        <p className="truncate text-[10px] text-mixer-muted">{preset.text}</p>
                        <span className="text-[8px] text-emerald-400/80">{preset.translation}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => feed.removeScripturePreset(preset.id)}
                        className="shrink-0 rounded p-0.5 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3 w-3 text-mixer-red" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={scriptureRef}
                onChange={(e) => handleScriptureRefChange(e.target.value)}
                placeholder="Reference (e.g. John 3:16)"
                className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <textarea
                value={scriptureText}
                onChange={(e) => setScriptureText(e.target.value)}
                rows={4}
                placeholder="Scripture text…"
                className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
              />
              <input
                type="text"
                value={scriptureTranslation}
                onChange={(e) => setScriptureTranslation(e.target.value)}
                placeholder="Translation"
                className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!scriptureRef.trim() || !scriptureText.trim()}
                  onClick={saveCurrentAsPreset}
                  className="flex items-center justify-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/30 py-2 text-[9px] font-bold tracking-wider text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-40"
                >
                  <Bookmark className="h-3 w-3" /> SAVE PRESET
                </button>
                <button
                  type="button"
                  disabled={!scriptureRef.trim() || !scriptureText.trim()}
                  onClick={() => {
                    feed.addScriptureSlide(scriptureRef.trim(), scriptureText.trim(), scriptureTranslation.trim());
                    setScriptureRef('');
                    setScriptureText('');
                    setLookupError(null);
                  }}
                  className="rounded bg-violet-600/30 py-2 text-[9px] font-bold tracking-wider text-violet-100 hover:bg-violet-600/50 disabled:opacity-40"
                >
                  ADD TO PREVIEW
                </button>
              </div>
              <button
                type="button"
                disabled={!scriptureRef.trim() || !scriptureText.trim()}
                onClick={() => {
                  feed.addScriptureSlide(scriptureRef.trim(), scriptureText.trim(), scriptureTranslation.trim());
                  feed.goLive();
                  setScriptureRef('');
                  setScriptureText('');
                }}
                className="w-full rounded bg-emerald-600/30 py-2 text-[10px] font-bold tracking-wider text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-40"
              >
                ADD & GO LIVE
              </button>
            </div>
            <div className="border-t border-mixer-border pt-3">
              <p className="mb-2 text-[10px] font-bold tracking-wider text-mixer-muted">SAMPLES</p>
              <div className="space-y-1">
                {SAMPLE_SCRIPTURES.map((s) => (
                  <button
                    key={s.ref}
                    type="button"
                    onClick={() => feed.addScriptureSlide(s.ref, s.text, s.translation)}
                    className="block w-full rounded border border-mixer-border/60 bg-mixer-surface/30 px-2 py-1.5 text-left hover:border-violet-500/40"
                  >
                    <span className="text-xs font-semibold text-white">{s.ref}</span>
                    <p className="truncate text-[10px] text-mixer-muted">{s.text}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {panel === 'lyrics' && (
          <div className="space-y-3">
            <p className="text-[10px] text-mixer-muted">
              Paste song lyrics — blank lines split stanzas into separate slides. Save songs to reuse later.
            </p>
            <input
              type="text"
              value={lyricsTitle}
              onChange={(e) => setLyricsTitle(e.target.value)}
              placeholder="Song title"
              className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
            />
            <textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              rows={10}
              placeholder={'Paste lyrics here…\n\nSeparate stanzas with a blank line.'}
              className="w-full rounded border border-mixer-border bg-black/40 px-2 py-1.5 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={!lyricsText.trim()}
                onClick={() => {
                  feed.importLyricsSlides(lyricsText, lyricsTitle);
                  setLyricsText('');
                }}
                className="rounded bg-violet-600/30 py-2 text-[9px] font-bold tracking-wider text-violet-100 hover:bg-violet-600/50 disabled:opacity-40"
              >
                ADD TO PREVIEW
              </button>
              <button
                type="button"
                disabled={!lyricsText.trim()}
                onClick={() => {
                  feed.importLyricsSlides(lyricsText, lyricsTitle);
                  feed.goLive();
                  setLyricsText('');
                }}
                className="rounded bg-emerald-600/30 py-2 text-[9px] font-bold tracking-wider text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-40"
              >
                ADD & GO LIVE
              </button>
            </div>
            <button
              type="button"
              disabled={!lyricsText.trim()}
              onClick={() => {
                feed.saveLyricsPreset(lyricsTitle, lyricsText);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-violet-500/40 py-2 text-[9px] font-bold tracking-wider text-violet-200 hover:bg-violet-950/40 disabled:opacity-40"
            >
              <Save className="h-3 w-3" /> SAVE LYRICS FOR LATER
            </button>
            {feed.state.lyricsPresets.length > 0 && (
              <div className="space-y-1.5 border-t border-mixer-border pt-3">
                <p className="text-[10px] font-bold tracking-wider text-mixer-muted">SAVED LYRICS</p>
                {feed.state.lyricsPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-start gap-2 rounded border border-mixer-border/60 bg-mixer-surface/30 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{preset.title}</p>
                      <p className="line-clamp-2 text-[10px] text-mixer-muted">{preset.lyrics.split('\n')[0]}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => feed.applyLyricsPreset(preset.id)}
                        className="rounded bg-violet-600/40 px-2 py-0.5 text-[8px] font-bold text-violet-100 hover:bg-violet-600/60"
                      >
                        PREVIEW
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          feed.applyLyricsPreset(preset.id);
                          feed.goLive();
                        }}
                        className="rounded bg-emerald-600/30 px-2 py-0.5 text-[8px] font-bold text-emerald-100"
                      >
                        LIVE
                      </button>
                      <button
                        type="button"
                        onClick={() => feed.removeLyricsPreset(preset.id)}
                        className="rounded p-0.5 hover:bg-red-500/20"
                        title="Delete saved lyrics"
                      >
                        <Trash2 className="h-3 w-3 text-mixer-red" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {panel === 'backgrounds' && (
          <div className="space-y-3">
            <p className="text-[10px] text-mixer-muted">Apply to preview slide. EasyWorship-style presets.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {DISPLAY_BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    feed.setPreviewBackground({ kind: 'preset', presetId: preset.id, overlayOpacity: 35 })
                  }
                  className="group overflow-hidden rounded border border-mixer-border hover:border-violet-500/50"
                >
                  <div className="aspect-video w-full" style={{ background: preset.preview }} />
                  <p className="truncate px-1 py-1 text-[9px] font-bold text-mixer-muted group-hover:text-white">
                    {preset.name}
                  </p>
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">
                CUSTOM COLOR
              </label>
              <input
                type="color"
                defaultValue="#1e3a5f"
                onChange={(e) =>
                  feed.setPreviewBackground({ kind: 'color', color: e.target.value, overlayOpacity: 0 })
                }
                className="h-10 w-full cursor-pointer rounded border border-mixer-border bg-transparent"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold tracking-wider text-mixer-muted">
                IMAGE OVERLAY DARKNESS
              </label>
              <input
                type="range"
                min={0}
                max={80}
                value={previewSlide?.background.overlayOpacity ?? 35}
                onChange={(e) => {
                  if (!previewSlide) return;
                  feed.updateSlide(previewSlide.id, {
                    background: {
                      ...previewSlide.background,
                      overlayOpacity: Number(e.target.value),
                    },
                  });
                }}
                className="w-full"
              />
            </div>
          </div>
        )}

        {panel === 'media' && (
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleMediaUpload} />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setMediaDragOver(true);
              }}
              onDragLeave={() => setMediaDragOver(false)}
              onDrop={(e) => void handleMediaDrop(e)}
              className={cn(
                'rounded border border-dashed py-4 text-center transition-colors',
                mediaDragOver
                  ? 'border-violet-400 bg-violet-950/40'
                  : 'border-violet-500/40 hover:bg-violet-950/20',
              )}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 text-[10px] font-bold tracking-wider text-violet-200"
              >
                <ImageIcon className="h-5 w-5" />
                UPLOAD OR DROP IMAGES & VIDEO
              </button>
              <p className="mt-1 text-[9px] text-mixer-muted">PNG with transparency works great as lower-thirds.</p>
            </div>
            {feed.state.mediaLibrary.length === 0 ? (
              <p className="text-center text-[10px] text-mixer-muted">No media yet — upload backgrounds, logos, or videos.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {feed.state.mediaLibrary.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded border border-mixer-border bg-mixer-surface/40">
                    <div className="relative aspect-video bg-[#0a0a0a]">
                      {item.type === 'image' ? (
                        <img src={item.url} alt={item.name} className="h-full w-full object-contain" />
                      ) : (
                        <>
                          <video
                            ref={(el) => {
                              videoPreviewRefs.current[item.id] = el;
                            }}
                            src={item.url}
                            className="h-full w-full object-contain"
                            muted
                            playsInline
                            loop
                          />
                          <button
                            type="button"
                            onClick={() => toggleVideoPreview(item.id)}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 text-white hover:bg-black/50"
                            title="Play / pause preview"
                          >
                            <Play className="h-8 w-8" />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="truncate px-2 py-1 text-[9px] text-mixer-muted">{item.name}</p>
                    <div className="flex flex-wrap gap-1 border-t border-mixer-border/60 p-2">
                      <button
                        type="button"
                        onClick={() => feed.stageMediaInPreview(item.id)}
                        className="rounded bg-violet-600/50 px-2 py-1 text-[8px] font-bold text-white hover:bg-violet-600/70"
                      >
                        <Monitor className="mr-0.5 inline h-3 w-3" />
                        PREVIEW
                      </button>
                      {item.type === 'image' && (
                        <>
                          <button
                            type="button"
                            onClick={() => feed.applyMediaAsBackground(item.id)}
                            className="rounded bg-white/10 px-2 py-1 text-[8px] font-bold text-white hover:bg-white/20"
                          >
                            BG
                          </button>
                          <button
                            type="button"
                            onClick={() => void feed.applyMediaAsForeground(item.id, 'lower-third')}
                            className="rounded bg-white/10 px-2 py-1 text-[8px] font-bold text-white hover:bg-white/20"
                          >
                            OVERLAY
                          </button>
                        </>
                      )}
                      {item.type === 'video' && (
                        <button
                          type="button"
                          onClick={() => feed.createVideoSlide(item.id)}
                          className="rounded bg-emerald-600/40 px-2 py-1 text-[8px] font-bold text-emerald-100 hover:bg-emerald-600/60"
                        >
                          VIDEO SLIDE
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => feed.removeMedia(item.id)}
                        className="ml-auto rounded bg-red-600/30 px-2 py-1 text-[8px] font-bold text-red-200 hover:bg-red-600/50"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {panel === 'playlist' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-mixer-muted">Service order — navigate with prev/next or go live from any slide.</p>
              <div className="flex gap-1">
                <input ref={playlistImportRef} type="file" accept="application/json,.json" hidden onChange={handleImportPlaylist} />
                <button
                  type="button"
                  onClick={handleExportPlaylist}
                  className="flex items-center gap-1 rounded border border-mixer-border px-2 py-1 text-[9px] font-bold text-mixer-muted hover:text-white"
                  title="Export service order as JSON"
                >
                  <Download className="h-3 w-3" /> EXPORT
                </button>
                <button
                  type="button"
                  onClick={() => playlistImportRef.current?.click()}
                  className="flex items-center gap-1 rounded border border-mixer-border px-2 py-1 text-[9px] font-bold text-mixer-muted hover:text-white"
                  title="Import service order from JSON"
                >
                  <Upload className="h-3 w-3" /> IMPORT
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {feed.state.playlist.map((slideId, index) => {
                const slide = feed.state.slides.find((s) => s.id === slideId);
                if (!slide) return null;
                return (
                  <div
                    key={slideId}
                    className={cn(
                      'flex items-center gap-2 rounded border px-2 py-1.5',
                      index === feed.state.playlistIndex
                        ? 'border-violet-500/50 bg-violet-950/30'
                        : 'border-mixer-border bg-mixer-surface/30',
                    )}
                  >
                    <span className="w-5 text-[10px] font-bold text-mixer-muted">{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => feed.goToPlaylistIndex(index)}
                      className="min-w-0 flex-1 truncate text-left text-xs text-white"
                    >
                      {slide.title}
                    </button>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          feed.goToPlaylistIndex(index);
                          feed.goLive();
                        }}
                        className="rounded px-1.5 py-0.5 text-[8px] font-bold text-emerald-300 hover:bg-emerald-600/20"
                        title="Go live with this slide"
                      >
                        LIVE
                      </button>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => feed.reorderPlaylist(index, index - 1)}
                        className="rounded p-0.5 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === feed.state.playlist.length - 1}
                        onClick={() => feed.reorderPlaylist(index, index + 1)}
                        className="rounded p-0.5 hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => feed.removeFromPlaylist(slideId)}
                        className="rounded p-0.5 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3 w-3 text-mixer-red" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {previewSlide && !feed.state.playlist.includes(previewSlide.id) && (
              <button
                type="button"
                onClick={() => feed.addToPlaylist(previewSlide.id)}
                className="mt-2 w-full rounded border border-dashed border-mixer-border py-2 text-[10px] font-bold text-mixer-muted hover:border-violet-500/40 hover:text-violet-200"
              >
                + ADD CURRENT SLIDE TO ORDER
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
