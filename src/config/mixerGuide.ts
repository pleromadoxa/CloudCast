/** User-facing mixer terminology and platform reference — keep language broadcast-friendly. */

export interface GuideEntry {
  term: string;
  description: string;
}

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  entries: GuideEntry[];
}

export const MIXER_QUICK_TERMS = {
  pst: 'Preview (PST) — the green monitor. What you queue before taking it live.',
  pgm: 'Program (PGM) — the red monitor. What viewers see on stream, record, and external output.',
  auxSub:
    'Auxiliary (Sub) — a second camera used as the small PiP inset or as the background behind chroma key. Pick a numbered input below; it does not replace PGM.',
  pip: 'Picture-in-Picture — shows Sub as a small box over your main PGM source.',
  chromaKey: 'KEY — chroma removes green/blue from PGM; luma keys out dark/blacks. Fill with Aux (Sub) or a preset background.',
  lumaKey: 'Luma Key — keys out dark areas and blacks from PGM so your background shows through.',
  cut: 'CUT — instantly swaps Preview to Program with no transition.',
  take: 'TAKE — moves Preview to Program using the selected effect and duration.',
  autoTrans: 'A/T — when on, TAKE uses your effect/duration instead of an instant cut.',
  ftb: 'FTB (Fade to Black) — fades program output to black.',
  swap: 'SWAP — exchanges Preview and Program sources.',
  exch: 'EXCH — exchanges Preview and Auxiliary (Sub) sources.',
} as const;

export const PLATFORM_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'monitors',
    title: 'Monitors & routing',
    intro: 'CloudCast follows standard broadcast switcher language.',
    entries: [
      {
        term: 'PST (Preview)',
        description:
          'Green-bordered monitor. Click an input to preview it here before going live. Double-click an input pad to cut it straight to PGM.',
      },
      {
        term: 'PGM (Program)',
        description:
          'Red-bordered monitor. This is your live output — what streams, records, and appears on external displays.',
      },
      {
        term: 'Auxiliary (Sub)',
        description:
          'A supporting camera angle. Used as the inset in Picture-in-Picture or as the fill/background when chroma key is enabled. Assign with the numbered Aux row in Sources — it never replaces PGM on its own.',
      },
      {
        term: 'Input pads',
        description:
          'Single-click sends a source to Preview. Double-click cuts it to Program. Red highlight = on air; green = in preview.',
      },
    ],
  },
  {
    id: 'panels',
    title: 'Mixer panels',
    intro: 'Open multiple panels at once from the grid under your camera inputs.',
    entries: [
      {
        term: 'Sources',
        description: 'Route cameras to PST/PGM, assign Auxiliary (Sub), PiP, and chroma on/off. No CUT/TAKE here — use Transitions.',
      },
      {
        term: 'Layers',
        description: 'Stack lower thirds, logos, tickers, and images. PST column previews; PGM column takes graphics live.',
      },
      {
        term: 'Audio',
        description: 'Per-input levels, mutes, solo, monitor mix, and USB audio routing.',
      },
      {
        term: 'Trans',
        description: 'Transition style, duration, T-bar, CUT / TAKE / A/T, and fade-to-black. Stream and REC are on Video Out.',
      },
      {
        term: 'Devices',
        description: 'Pairing code, stream quality per phone, IP camera URL, and USB audio links.',
      },
      {
        term: 'Stream',
        description: 'RTMP destinations, connection tests, and Go Live to YouTube or custom servers.',
      },
      {
        term: 'Setup',
        description: 'Aspect ratio, preview layout, multiview, recording, shortcuts, and this guide.',
      },
    ],
  },
  {
    id: 'graphics',
    title: 'Graphics & layers',
    entries: [
      {
        term: 'Layer stack',
        description:
          'Top row = front (highest z-order). Drag the grip to reorder. Trash removes a layer from the stack.',
      },
      {
        term: 'PST / PGM columns',
        description:
          'Eye icon = show on preview monitor. Radio icon = take live on program. OFF removes from air.',
      },
      {
        term: 'Lower third',
        description: 'Title and subline overlay. Drag on the preview monitor to reposition horizontally.',
      },
      {
        term: 'CLR PGM',
        description: 'Clears all graphics from program output without deleting your layer stack.',
      },
    ],
  },
  {
    id: 'transport',
    title: 'Transport & output',
    entries: [
      {
        term: 'CUT',
        description: 'Instant Preview → Program switch. No dissolve or wipe.',
      },
      {
        term: 'TAKE',
        description: 'Preview → Program with the active effect and duration (mix, wipe, fade, dip).',
      },
      {
        term: 'A/T (Auto trans)',
        description: 'Toggles whether TAKE uses transitions or behaves like a cut.',
      },
      {
        term: 'STREAM / ON AIR',
        description: 'Starts or stops RTMP output to your enabled destinations.',
      },
      {
        term: 'REC',
        description: 'Saves PGM to cloud storage on Pro plans. Files appear in your profile dashboard.',
      },
      {
        term: 'Video Out column',
        description: 'Quick access to stream, record, and master mute on the right edge of the mixer deck.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Setup & display',
    entries: [
      {
        term: 'Aspect ratio',
        description: 'Shapes preview tiles and PGM framing (16:9 landscape, 9:16 vertical, etc.).',
      },
      {
        term: 'Multiview',
        description: 'Shows all live inputs in a grid above the main monitors.',
      },
      {
        term: 'Ext output',
        description: 'Sends clean PGM to a second monitor or AirPlay when supported by your browser.',
      },
      {
        term: 'Safe zone / crosshair',
        description: 'Overlays for framing titles and graphics inside broadcast-safe areas.',
      },
      {
        term: 'Keyboard shortcuts',
        description: 'Assign keys for cut, take, stream, and layer actions. Click a pad then press a key.',
      },
    ],
  },
];
