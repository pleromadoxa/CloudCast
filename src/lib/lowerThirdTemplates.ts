import type {
  LowerThirdCategory,
  LowerThirdCustomization,
  LowerThirdTemplate,
  LowerThirdTemplateId,
} from '../types/overlays';
import { DEFAULT_LOWER_THIRD_CUSTOMIZATION } from '../types/overlays';

function theme(
  overrides: Partial<LowerThirdCustomization> & Pick<LowerThirdCustomization, 'accentColor'>,
): LowerThirdCustomization {
  return { ...DEFAULT_LOWER_THIRD_CUSTOMIZATION, ...overrides };
}

function tpl(
  id: LowerThirdTemplateId,
  label: string,
  description: string,
  category: LowerThirdCategory,
  layout: LowerThirdTemplate['layout'],
  customization: LowerThirdCustomization,
): LowerThirdTemplate {
  return { id, label, description, category, layout, customization };
}

export const LOWER_THIRD_TEMPLATES: LowerThirdTemplate[] = [
  tpl('broadcast-red', 'Broadcast Red', 'Classic live news — bold red accent', 'news', 'accent-top', theme({ accentColor: '#dc2626', backgroundColor: 'rgba(0,0,0,0.85)', uppercase: true })),
  tpl('news-blue', 'News Blue', 'Network evening news blue gradient', 'news', 'side-stripe', theme({ accentColor: '#38bdf8', backgroundColor: 'rgba(30,58,138,0.95)', subtextColor: '#bfdbfe' })),
  tpl('alert-orange', 'Alert Orange', 'Urgent developing story orange bar', 'news', 'solid-bar', theme({ accentColor: '#ea580c', backgroundColor: 'rgba(124,45,18,0.92)', uppercase: true })),
  tpl('midnight-desk', 'Midnight Desk', 'Late-night anchor dark slate', 'news', 'double-rule', theme({ accentColor: '#64748b', backgroundColor: 'rgba(15,23,42,0.9)', uppercase: false })),
  tpl('white-house', 'White House', 'Government briefing clean white rule', 'news', 'outline-box', theme({ accentColor: '#1e3a8a', backgroundColor: 'rgba(255,255,255,0.12)', textColor: '#f8fafc', borderRadius: 'sm' })),
  tpl('global-wire', 'Global Wire', 'International wire red underline', 'news', 'accent-top', theme({ accentColor: '#b91c1c', backgroundColor: 'rgba(23,23,23,0.88)', fontSize: 'lg' })),
  tpl('field-report', 'Field Report', 'On-location correspondent glass', 'news', 'glass-minimal', theme({ accentColor: '#facc15', backgroundColor: 'rgba(0,0,0,0.45)', uppercase: false, borderRadius: 'sm' })),
  tpl('anchor-desk', 'Anchor Desk', 'Studio anchor split duo layout', 'news', 'split-duo', theme({ accentColor: '#0ea5e9', backgroundColor: 'rgba(2,6,23,0.9)', subtextColor: '#7dd3fc' })),

  tpl('sport-gold', 'Sport Gold', 'ESPN-style gold & black', 'sports', 'sport-split', theme({ accentColor: '#f59e0b', backgroundColor: 'rgba(24,24,27,0.95)', textColor: '#fbbf24', uppercase: true })),
  tpl('stadium-green', 'Stadium Green', 'Pitch-side sports green bar', 'sports', 'solid-bar', theme({ accentColor: '#16a34a', backgroundColor: 'rgba(5,46,22,0.9)', textColor: '#bbf7d0' })),
  tpl('racing-checker', 'Racing Checker', 'Motorsport checkered accent', 'sports', 'angled-ribbon', theme({ accentColor: '#ffffff', backgroundColor: 'rgba(0,0,0,0.92)', textColor: '#fafafa', uppercase: true })),
  tpl('esports-neon', 'Esports Neon', 'Gaming neon glow lower third', 'sports', 'neon-glow', theme({ accentColor: '#22d3ee', backgroundColor: 'rgba(15,23,42,0.75)', textColor: '#67e8f9', showLiveBadge: true })),

  tpl('corporate-navy', 'Corporate Navy', 'Professional navy silver stripe', 'corporate', 'corporate-stripe', theme({ accentColor: '#94a3b8', backgroundColor: 'rgba(15,23,42,0.9)', uppercase: false })),
  tpl('slate-brief', 'Slate Brief', 'Quarterly briefing minimal slate', 'corporate', 'glass-minimal', theme({ accentColor: '#cbd5e1', backgroundColor: 'rgba(30,41,59,0.8)', uppercase: false, borderRadius: 'sm' })),
  tpl('executive-gold', 'Executive Gold', 'Boardroom gold accent bar', 'corporate', 'accent-top', theme({ accentColor: '#ca8a04', backgroundColor: 'rgba(23,23,23,0.9)', textColor: '#fef3c7' })),
  tpl('startup-clean', 'Startup Clean', 'Tech keynote clean pill', 'corporate', 'pill-live', theme({ accentColor: '#6366f1', backgroundColor: 'rgba(49,46,129,0.85)', uppercase: false, borderRadius: 'full' })),

  tpl('live-gradient', 'Live Gradient', 'Modern streamer gradient pill', 'live', 'pill-live', theme({ accentColor: '#ec4899', backgroundColor: 'rgba(88,28,135,0.85)', showLiveBadge: true, borderRadius: 'full' })),
  tpl('twitch-purple', 'Twitch Purple', 'Purple live stream identity', 'live', 'pill-live', theme({ accentColor: '#a855f7', backgroundColor: 'rgba(59,7,100,0.88)', showLiveBadge: true, borderRadius: 'full' })),
  tpl('youtube-red', 'YouTube Red', 'Creator broadcast red live tag', 'live', 'pill-live', theme({ accentColor: '#ef4444', backgroundColor: 'rgba(127,29,29,0.9)', showLiveBadge: true, borderRadius: 'full' })),
  tpl('podcast-warm', 'Podcast Warm', 'Warm talk-show lower third', 'live', 'solid-bar', theme({ accentColor: '#f97316', backgroundColor: 'rgba(67,20,7,0.88)', uppercase: false, borderRadius: 'md' })),

  tpl('minimal-white', 'Minimal White', 'Clean frosted glass line', 'creative', 'glass-minimal', theme({ accentColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)', uppercase: false, borderRadius: 'sm' })),
  tpl('glass-frost', 'Glass Frost', 'Heavy blur documentary style', 'creative', 'glass-minimal', theme({ accentColor: '#e2e8f0', backgroundColor: 'rgba(148,163,184,0.25)', uppercase: false, opacity: 90 })),
  tpl('retro-crt', 'Retro CRT', 'Vintage TV scanline aesthetic', 'creative', 'outline-box', theme({ accentColor: '#4ade80', backgroundColor: 'rgba(0,0,0,0.7)', textColor: '#86efac', fontSize: 'sm', borderRadius: 'none' })),
  tpl('cinema-dark', 'Cinema Dark', 'Film credit elegant dark bar', 'creative', 'double-rule', theme({ accentColor: '#a8a29e', backgroundColor: 'rgba(12,10,9,0.92)', uppercase: false, fontSize: 'sm' })),

  /* ================================================================
     26 NEW LOWER THIRD DESIGNS — reaching 50 total
     ================================================================ */

  // ── News (8 new) ──
  tpl('breaking-flash', 'Breaking Flash', 'Animated red flash breaking banner', 'news', 'gradient-bar', theme({ accentColor: '#dc2626', backgroundColor: 'rgba(0,0,0,0.92)', uppercase: true, fontSize: 'lg' })),
  tpl('election-night', 'Election Night', 'Purple-blue election coverage bar', 'news', 'gradient-border', theme({ accentColor: '#7c3aed', backgroundColor: 'rgba(15,23,42,0.95)', textColor: '#c4b5fd', uppercase: true })),
  tpl('world-map', 'World Map', 'International correspondent glass card', 'news', 'glass-card', theme({ accentColor: '#0ea5e9', backgroundColor: 'rgba(15,23,42,0.7)', textColor: '#e0f2fe', borderRadius: 'md' })),
  tpl('parliament', 'Parliament', 'Government debate maroon bar', 'news', 'left-thick-bar', theme({ accentColor: '#881337', backgroundColor: 'rgba(30,0,10,0.9)', textColor: '#fce7f3', uppercase: true })),
  tpl('investigative', 'Investigative', 'Dark investigative journalism minimal', 'news', 'minimal-line', theme({ accentColor: '#d4d4d8', backgroundColor: 'rgba(9,9,11,0.88)', textColor: '#fafafa', uppercase: false, fontSize: 'sm' })),
  tpl('morning-show', 'Morning Show', 'Bright morning warm gradient pill', 'news', 'frosted-pill', theme({ accentColor: '#f97316', backgroundColor: 'rgba(251,146,60,0.15)', textColor: '#fff7ed', borderRadius: 'full' })),
  tpl('news-ticker', 'News Ticker', 'Scrolling ticker-style lower third', 'news', 'wide-banner', theme({ accentColor: '#dc2626', backgroundColor: 'rgba(10,10,10,0.95)', textColor: '#ffffff', uppercase: true, fontSize: 'lg' })),
  tpl('press-conference', 'Press Conference', 'Official podium plate with seal', 'news', 'tag-badge', theme({ accentColor: '#1e40af', backgroundColor: 'rgba(255,255,255,0.1)', textColor: '#dbeafe', borderRadius: 'sm' })),

  // ── Sports (6 new) ──
  tpl('basketball-court', 'Basketball Court', 'Hardwood court orange accent', 'sports', 'diagonal-cut', theme({ accentColor: '#f97316', backgroundColor: 'rgba(30,10,0,0.92)', textColor: '#fed7aa', uppercase: true })),
  tpl('football-stadium', 'Football Stadium', 'Gridiron green endzone bar', 'sports', 'bold-stripe', theme({ accentColor: '#15803d', backgroundColor: 'rgba(5,30,10,0.9)', textColor: '#bbf7d0', uppercase: true })),
  tpl('tennis-court', 'Tennis Court', 'Clay court warm minimal', 'sports', 'underline-slide', theme({ accentColor: '#d97706', backgroundColor: 'rgba(120,53,15,0.12)', textColor: '#fef3c7', borderRadius: 'sm' })),
  tpl('boxing-ring', 'Boxing Ring', 'Red corner dramatic split', 'sports', 'split-header', theme({ accentColor: '#dc2626', backgroundColor: 'rgba(20,0,0,0.95)', textColor: '#fecaca', uppercase: true, fontSize: 'lg' })),
  tpl('f1-pitlane', 'F1 Pitlane', 'Racing telemetry strip', 'sports', 'gradient-bar', theme({ accentColor: '#ef4444', backgroundColor: 'rgba(0,0,0,0.95)', textColor: '#fca5a5', uppercase: true })),
  tpl('cricket-pitch', 'Cricket Pitch', 'Olive green outfield bar', 'sports', 'layered-stack', theme({ accentColor: '#65a30d', backgroundColor: 'rgba(20,30,5,0.9)', textColor: '#d9f99d', uppercase: false })),

  // ── Corporate (5 new) ──
  tpl('annual-report', 'Annual Report', 'Clean white paper-style card', 'corporate', 'glass-card', theme({ accentColor: '#1e3a8a', backgroundColor: 'rgba(255,255,255,0.08)', textColor: '#f1f5f9', borderRadius: 'md', uppercase: false })),
  tpl('tech-keynote', 'Tech Keynote', 'Dark gradient with neon accent', 'corporate', 'neon-glow', theme({ accentColor: '#8b5cf6', backgroundColor: 'rgba(15,5,30,0.85)', textColor: '#ddd6fe', borderRadius: 'md' })),
  tpl('merger-announce', 'Merger Announce', 'Dual-tone corporate split', 'corporate', 'dual-accent', theme({ accentColor: '#0369a1', backgroundColor: 'rgba(15,23,42,0.92)', textColor: '#e0f2fe', uppercase: true })),
  tpl('quarterly-earnings', 'Quarterly Earnings', 'Green/red market indicator', 'corporate', 'corner-bracket', theme({ accentColor: '#16a34a', backgroundColor: 'rgba(5,30,15,0.88)', textColor: '#bbf7d0', borderRadius: 'sm' })),
  tpl('boardroom', 'Boardroom', 'Dark executive minimalist', 'corporate', 'shadow-plate', theme({ accentColor: '#a1a1aa', backgroundColor: 'rgba(9,9,11,0.9)', textColor: '#e4e4e7', uppercase: false })),

  // ── Live / Streaming (4 new) ──
  tpl('kick-live', 'Kick Live', 'Green neon live stream pill', 'live', 'frosted-pill', theme({ accentColor: '#22c55e', backgroundColor: 'rgba(5,46,22,0.8)', textColor: '#bbf7d0', showLiveBadge: true, borderRadius: 'full' })),
  tpl('discord-stage', 'Discord Stage', 'Indigo community stream bar', 'live', 'gradient-bar', theme({ accentColor: '#5865f2', backgroundColor: 'rgba(30,33,72,0.88)', textColor: '#c7d2fe', showLiveBadge: true })),
  tpl('marathon-stream', 'Marathon Stream', 'Endurance orange progress bar', 'live', 'top-accent-bar', theme({ accentColor: '#f97316', backgroundColor: 'rgba(30,10,0,0.85)', textColor: '#ffedd5', showLiveBadge: true, borderRadius: 'md' })),
  tpl('collab-split', 'Collab Split', 'Dual-host split screen label', 'live', 'split-name', theme({ accentColor: '#ec4899', backgroundColor: 'rgba(50,10,30,0.85)', textColor: '#fce7f3', borderRadius: 'sm' })),

  // ── Creative / Documentary (3 new) ──
  tpl('nature-doc', 'Nature Doc', 'Earth-tone documentary credit', 'creative', 'cinematic-bar', theme({ accentColor: '#65a30d', backgroundColor: 'rgba(10,20,5,0.85)', textColor: '#d9f99d', uppercase: false, fontSize: 'sm' })),
  tpl('true-crime', 'True Crime', 'Dark crimson mystery plate', 'creative', 'retro-box', theme({ accentColor: '#991b1b', backgroundColor: 'rgba(15,0,0,0.92)', textColor: '#fecaca', uppercase: false, borderRadius: 'none' })),
  tpl('art-showcase', 'Art Showcase', 'Gallery-white minimal with thin rule', 'creative', 'text-only', theme({ accentColor: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', textColor: '#ffffff', uppercase: false, fontSize: 'sm', borderRadius: 'none' })),
];

export const LOWER_THIRD_SEGMENTS: { id: LowerThirdCategory; label: string; description: string }[] = [
  { id: 'news', label: 'News', description: 'Breaking, desk & field reporting' },
  { id: 'sports', label: 'Sports', description: 'Scores, stadium & esports' },
  { id: 'corporate', label: 'Corporate', description: 'Briefings & executive' },
  { id: 'live', label: 'Live', description: 'Streaming & on-air identity' },
  { id: 'creative', label: 'Creative', description: 'Documentary & cinematic' },
];

export const DEFAULT_LOWER_THIRD_TEMPLATE: LowerThirdTemplateId = 'broadcast-red';

export function getLowerThirdTemplate(id: LowerThirdTemplateId): LowerThirdTemplate {
  return LOWER_THIRD_TEMPLATES.find((t) => t.id === id) ?? LOWER_THIRD_TEMPLATES[0];
}

export function getLowerThirdSampleText(id: LowerThirdTemplateId): { title: string; sub: string } {
  const t = getLowerThirdTemplate(id);
  const samples: Record<LowerThirdCategory, { title: string; sub: string }> = {
    news: { title: 'BREAKING NEWS', sub: 'CloudCast Live · New York' },
    sports: { title: 'FINAL SCORE', sub: 'Week 12 · Championship' },
    corporate: { title: 'Quarterly Briefing', sub: 'Spatial Regal Digital Labs' },
    live: { title: 'CloudCast Live', sub: 'streaming now' },
    creative: { title: 'Sarah Chen', sub: 'Chief Correspondent' },
  };
  return samples[t.category];
}

export function resolveLowerThirdCustomization(
  templateId: LowerThirdTemplateId,
  overrides?: Partial<LowerThirdCustomization>,
): LowerThirdCustomization {
  const base = getLowerThirdTemplate(templateId).customization;
  return { ...base, ...overrides };
}
