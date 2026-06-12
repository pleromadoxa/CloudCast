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
    corporate: { title: 'Quarterly Briefing', sub: 'Quantum Regal Digital Labs' },
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
