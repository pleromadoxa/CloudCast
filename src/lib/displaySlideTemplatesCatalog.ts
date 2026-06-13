import type { DisplayBackground, DisplaySlide, DisplaySlideLayout, DisplaySlideType } from '../types/displayFeed';

export interface DisplaySlideTemplate {
  id: string;
  name: string;
  category: 'worship' | 'announcement' | 'media' | 'blank' | 'banner' | 'scripture' | 'event' | 'ministry';
  description: string;
  type: DisplaySlideType;
  layout?: DisplaySlideLayout;
  bannerHeight?: number;
  background?: DisplayBackground;
  build: () => Omit<DisplaySlide, 'id' | 'createdAt' | 'updatedAt'>;
}

function bg(presetId: string, overlayOpacity = 35): DisplayBackground {
  return { kind: 'preset', presetId, overlayOpacity };
}

function fields(
  entries: Array<{ label: string; value: string; visible?: boolean; size?: DisplaySlide['fields'][0]['size']; color?: string }>,
) {
  return entries.map((e, i) => ({
    id: `f${i}`,
    label: e.label,
    value: e.value,
    visible: e.visible ?? true,
    size: e.size ?? ('md' as const),
    align: 'center' as const,
    color: e.color,
  }));
}

function bannerTemplate(
  id: string,
  name: string,
  description: string,
  presetId: string,
  title: string,
  body: string,
  overlayOpacity = 55,
): DisplaySlideTemplate {
  return {
    id,
    name,
    category: 'banner',
    description,
    type: 'announcement',
    layout: 'banner-bottom',
    bannerHeight: 30,
    background: bg(presetId, overlayOpacity),
    build: () => ({
      title: name,
      type: 'announcement',
      layout: 'banner-bottom',
      bannerHeight: 30,
      background: bg(presetId, overlayOpacity),
      fields: fields([
        { label: 'Title', value: title, size: 'lg' },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: body, size: 'md' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  };
}

function worshipTemplate(
  id: string,
  name: string,
  description: string,
  presetId: string,
  title: string,
  subtitle: string,
  body: string,
): DisplaySlideTemplate {
  return {
    id,
    name,
    category: 'worship',
    description,
    type: 'announcement',
    background: bg(presetId),
    build: () => ({
      title: name,
      type: 'announcement',
      background: bg(presetId),
      fields: fields([
        { label: 'Title', value: title, size: '2xl' },
        { label: 'Subtitle', value: subtitle, size: 'lg' },
        { label: 'Body', value: body, size: 'md', color: '#94a3b8' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  };
}

/** Extended catalog — 55+ beautiful slide layouts. */
export const EXTENDED_DISPLAY_TEMPLATES: DisplaySlideTemplate[] = [
  // Information banners (bottom 30%, top clear for mixer key)
  bannerTemplate('banner-welcome', 'Info Banner · Welcome', 'Bottom strip welcome message', 'worship-deep-blue', 'Welcome', "We're glad you're here today"),
  bannerTemplate('banner-offering', 'Info Banner · Offering', 'Giving moment banner', 'worship-golden-hour', 'Offering Time', 'Give cheerfully — 2 Corinthians 9:7'),
  bannerTemplate('banner-prayer', 'Info Banner · Prayer', 'Prayer moment banner', 'worship-emerald', 'Let Us Pray', 'Please bow your heads'),
  bannerTemplate('banner-announce', 'Info Banner · Announce', 'Quick announcement strip', 'modern-slate', 'Announcements', 'Stay tuned for updates'),
  bannerTemplate('banner-event', 'Info Banner · Event', 'Event promo banner', 'gradient-sunset', 'Upcoming Event', 'Join us this week'),
  bannerTemplate('banner-youth', 'Info Banner · Youth', 'Youth ministry banner', 'gradient-aurora', 'Youth Night', 'Friday at 7 PM'),
  bannerTemplate('banner-connect', 'Info Banner · Connect', 'Connection card banner', 'modern-rose', 'Get Connected', 'Visit the welcome desk'),
  bannerTemplate('banner-social', 'Info Banner · Social', 'Social media banner', 'gradient-broadcast', 'Follow Us', '@YourChurch'),
  bannerTemplate('banner-scripture', 'Info Banner · Scripture', 'Scripture reference strip', 'solid-black', 'John 3:16', 'For God so loved the world…'),
  bannerTemplate('banner-countdown', 'Info Banner · Starting', 'Pre-service countdown strip', 'worship-purple-glow', 'Starting Soon', 'Service begins shortly'),
  bannerTemplate('banner-communion', 'Info Banner · Communion', "Lord's Supper banner", 'worship-golden-hour', 'Communion', 'Remember His sacrifice'),
  bannerTemplate('banner-baptism', 'Info Banner · Baptism', 'Baptism celebration banner', 'nature-ocean', 'Baptism Sunday', 'Celebrating new life in Christ'),

  // Worship moments
  worshipTemplate('worship-benediction', 'Benediction', 'Closing blessing', 'worship-purple-glow', 'Benediction', 'Go in peace', 'Numbers 6:24-26'),
  worshipTemplate('worship-altar-call', 'Altar Call', 'Invitation to respond', 'worship-emerald', 'Respond', 'Come as you are', 'The altar is open'),
  worshipTemplate('worship-worship', 'Worship Time', 'Enter worship', 'gradient-aurora', 'Worship', 'Let everything that has breath praise the Lord', 'Psalm 150:6'),
  worshipTemplate('worship-sermon', 'Sermon Title', 'Message title slide', 'worship-deep-blue', 'Sermon Title', 'Pastor Name', 'Series · Part 1'),
  worshipTemplate('worship-series', 'Sermon Series', 'Multi-week series intro', 'modern-slate', 'Series Title', 'A Journey Through Faith', 'Week 1'),
  worshipTemplate('worship-baptism-full', 'Baptism', 'Full-screen baptism', 'nature-ocean', 'Baptism', 'Buried with Him in baptism', 'Romans 6:4'),
  worshipTemplate('worship-dedication', 'Dedication', 'Baby / child dedication', 'worship-golden-hour', 'Dedication', 'Train up a child', 'Proverbs 22:6'),
  worshipTemplate('worship-missions', 'Missions', 'Missions emphasis', 'nature-forest', 'Missions', 'Go and make disciples', 'Matthew 28:19'),
  worshipTemplate('worship-testimony', 'Testimony', 'Share your story', 'modern-rose', 'Testimony Time', "We'd love to hear", 'How God is moving'),
  worshipTemplate('worship-holy-spirit', 'Holy Spirit', 'Spirit-led moment', 'worship-purple-glow', 'Holy Spirit', 'Move in this place', 'Acts 2:1-4'),

  // Scripture layouts
  {
    id: 'scripture-centered',
    name: 'Scripture · Centered',
    category: 'scripture',
    description: 'Classic centered scripture',
    type: 'scripture',
    background: bg('solid-black', 0),
    build: () => ({
      title: 'Scripture',
      type: 'scripture',
      background: bg('solid-black', 0),
      fields: fields([
        { label: 'Reference', value: 'Romans 8:28', size: 'lg', color: '#94a3b8' },
        { label: 'Scripture', value: 'And we know that in all things God works for the good…', size: 'xl' },
        { label: 'Translation', value: 'WEB', size: 'sm', color: '#64748b' },
        { label: 'Footer', value: '', visible: false },
      ]),
      scripture: { reference: 'Romans 8:28', text: 'And we know that in all things God works for the good…', translation: 'WEB' },
    }),
  },
  {
    id: 'scripture-banner',
    name: 'Scripture · Banner',
    category: 'scripture',
    description: 'Scripture in bottom banner for key overlay',
    type: 'scripture',
    layout: 'banner-bottom',
    bannerHeight: 30,
    background: bg('solid-charcoal', 60),
    build: () => ({
      title: 'Scripture Banner',
      type: 'scripture',
      layout: 'banner-bottom',
      bannerHeight: 30,
      background: bg('solid-charcoal', 60),
      fields: fields([
        { label: 'Reference', value: 'Psalm 23:1', size: 'md', color: '#fcd34d' },
        { label: 'Scripture', value: 'The Lord is my shepherd; I shall not want.', size: 'lg' },
        { label: 'Translation', value: 'KJV', size: 'sm', color: '#64748b' },
        { label: 'Footer', value: '', visible: false },
      ]),
      scripture: { reference: 'Psalm 23:1', text: 'The Lord is my shepherd; I shall not want.', translation: 'KJV' },
    }),
  },
  {
    id: 'scripture-verse-day',
    name: 'Verse of the Day',
    category: 'scripture',
    description: 'Daily verse highlight',
    type: 'scripture',
    background: bg('gradient-aurora', 25),
    build: () => ({
      title: 'Verse of the Day',
      type: 'scripture',
      background: bg('gradient-aurora', 25),
      fields: fields([
        { label: 'Reference', value: 'Philippians 4:13', size: 'lg', color: '#a78bfa' },
        { label: 'Scripture', value: 'I can do all things through Christ who strengthens me.', size: 'xl' },
        { label: 'Translation', value: 'WEB', size: 'sm' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'scripture-passage',
    name: 'Scripture · Passage',
    category: 'scripture',
    description: 'Multi-verse passage layout',
    type: 'scripture',
    background: bg('worship-deep-blue', 20),
    build: () => ({
      title: 'Passage',
      type: 'scripture',
      background: bg('worship-deep-blue', 20),
      fields: fields([
        { label: 'Reference', value: 'Psalm 23:1-3', size: 'lg', color: '#94a3b8' },
        { label: 'Scripture', value: '1. The Lord is my shepherd…\n2. He makes me lie down…\n3. He restores my soul.', size: 'lg' },
        { label: 'Translation', value: 'WEB', size: 'sm' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },

  // Announcements & events
  worshipTemplate('announce-bulletin', 'Bulletin', 'Weekly bulletin', 'modern-slate', 'This Week', 'Check your bulletin for details', ''),
  worshipTemplate('announce-class', 'Class Signup', 'Class registration', 'gradient-broadcast', 'Sign Up Today', 'Classes starting soon', 'Register at the welcome desk'),
  worshipTemplate('announce-volunteer', 'Volunteers Needed', 'Serve opportunity', 'worship-emerald', 'Serve', 'Volunteers needed', 'Join a team today'),
  worshipTemplate('announce-parking', 'Parking', 'Parking directions', 'solid-charcoal', 'Parking', 'Additional parking in Lot B', 'Follow the signs'),
  worshipTemplate('announce-childcare', 'Childcare', 'Kids ministry info', 'gradient-aurora', 'Kids Ministry', 'Ages 0–12', 'Check in at the kiosk'),
  worshipTemplate('announce-coffee', 'Fellowship', 'Coffee & fellowship', 'worship-golden-hour', 'Fellowship Time', 'Coffee & conversation', 'Join us in the lobby'),
  worshipTemplate('event-conference', 'Conference', 'Special conference', 'gradient-sunset', 'Annual Conference', 'March 15–17', 'Register online'),
  worshipTemplate('event-retreat', 'Retreat', 'Church retreat', 'nature-forest', 'Church Retreat', 'Get away & grow', 'Sign up this Sunday'),
  worshipTemplate('event-vbs', 'VBS', 'Vacation Bible School', 'gradient-aurora', 'VBS 2026', 'Kids ages 4–12', 'June 10–14'),
  worshipTemplate('event-christmas', 'Christmas', 'Christmas service', 'worship-purple-glow', 'Christmas Eve', 'Candlelight service', 'December 24 at 7 PM'),

  // Lyrics & media
  {
    id: 'lyrics-chorus',
    name: 'Lyrics · Chorus',
    category: 'worship',
    description: 'Chorus highlight',
    type: 'lyrics',
    background: bg('gradient-aurora', 30),
    build: () => ({
      title: 'Chorus',
      type: 'lyrics',
      background: bg('gradient-aurora', 30),
      fields: fields([
        { label: 'Title', value: 'Song Title', size: 'md', color: '#a78bfa' },
        { label: 'Subtitle', value: 'Chorus', size: 'sm' },
        { label: 'Body', value: 'Chorus line one\nChorus line two\nChorus line three', size: '2xl' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'lyrics-bridge',
    name: 'Lyrics · Bridge',
    category: 'worship',
    description: 'Bridge section',
    type: 'lyrics',
    background: bg('worship-purple-glow', 35),
    build: () => ({
      title: 'Bridge',
      type: 'lyrics',
      background: bg('worship-purple-glow', 35),
      fields: fields([
        { label: 'Title', value: 'Song Title', size: 'md' },
        { label: 'Subtitle', value: 'Bridge', size: 'sm', color: '#c4b5fd' },
        { label: 'Body', value: 'Bridge line one\nBridge line two', size: 'xl' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'lyrics-minimal',
    name: 'Lyrics · Minimal',
    category: 'worship',
    description: 'Clean minimal lyrics',
    type: 'lyrics',
    background: bg('solid-black', 10),
    build: () => ({
      title: 'Lyrics',
      type: 'lyrics',
      background: bg('solid-black', 10),
      fields: fields([
        { label: 'Title', value: '', visible: false },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: 'Line one\nLine two\nLine three', size: '2xl' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },

  // Ministry
  worshipTemplate('ministry-youth', 'Youth Ministry', 'Youth group', 'gradient-aurora', 'Youth Group', 'Middle & High School', 'Wednesdays 6:30 PM'),
  worshipTemplate('ministry-kids', 'Kids Church', 'Children ministry', 'gradient-sunset', 'Kids Church', 'Ages 4–11', 'Fun & faith-filled'),
  worshipTemplate('ministry-mens', "Men's Ministry", 'Men gathering', 'modern-slate', "Men's Breakfast", 'First Saturday monthly', 'All men welcome'),
  worshipTemplate('ministry-womens', "Women's Ministry", 'Women gathering', 'modern-rose', "Women's Bible Study", 'Tuesdays 10 AM', 'Childcare provided'),
  worshipTemplate('ministry-small-groups', 'Small Groups', 'Community groups', 'worship-emerald', 'Small Groups', 'Find your people', 'Sign up online'),
  worshipTemplate('ministry-prayer-team', 'Prayer Team', 'Prayer ministry', 'worship-deep-blue', 'Prayer Team', 'Intercede with us', 'Prayer room open after service'),
  worshipTemplate('ministry-worship-team', 'Worship Team', 'Music ministry', 'worship-purple-glow', 'Worship Team', 'Auditions open', 'Contact worship pastor'),

  // Lower third style
  {
    id: 'lower-third-name',
    name: 'Lower Third · Name',
    category: 'banner',
    description: 'Name title lower third',
    type: 'announcement',
    layout: 'lower-third',
    bannerHeight: 22,
    background: bg('solid-black', 70),
    build: () => ({
      title: 'Lower Third',
      type: 'announcement',
      layout: 'lower-third',
      bannerHeight: 22,
      background: bg('solid-black', 70),
      fields: fields([
        { label: 'Title', value: 'Speaker Name', size: 'lg' },
        { label: 'Subtitle', value: 'Title / Role', size: 'sm', color: '#94a3b8' },
        { label: 'Body', value: '', visible: false },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'lower-third-quote',
    name: 'Lower Third · Quote',
    category: 'banner',
    description: 'Quote strip at bottom',
    type: 'announcement',
    layout: 'lower-third',
    bannerHeight: 25,
    background: bg('worship-deep-blue', 65),
    build: () => ({
      title: 'Quote',
      type: 'announcement',
      layout: 'lower-third',
      bannerHeight: 25,
      background: bg('worship-deep-blue', 65),
      fields: fields([
        { label: 'Title', value: '', visible: false },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: '"Short inspirational quote here"', size: 'md' },
        { label: 'Footer', value: '— Attribution', size: 'sm', color: '#94a3b8' },
      ]),
    }),
  },

  // Blank & custom starters
  {
    id: 'blank-green-key',
    name: 'Blank · Key Green',
    category: 'blank',
    description: 'Green screen for mixer chroma key',
    type: 'blank',
    layout: 'full',
    background: { kind: 'color', color: '#00ff00', overlayOpacity: 0 },
    build: () => ({
      title: 'Key Green',
      type: 'blank',
      layout: 'full',
      background: { kind: 'color', color: '#00ff00', overlayOpacity: 0 },
      fields: fields([
        { label: 'Title', value: '', visible: false },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: '', visible: false },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'blank-transparent-banner',
    name: 'Blank · Banner Zone',
    category: 'blank',
    description: 'Top clear, bottom banner zone only',
    type: 'blank',
    layout: 'banner-bottom',
    bannerHeight: 30,
    background: bg('solid-black', 0),
    build: () => ({
      title: 'Banner Zone',
      type: 'blank',
      layout: 'banner-bottom',
      bannerHeight: 30,
      background: bg('solid-black', 0),
      fields: fields([
        { label: 'Title', value: 'Your text here', size: 'lg' },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: '', visible: false },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'media-fullscreen',
    name: 'Media · Fullscreen',
    category: 'media',
    description: 'Full-screen media placeholder',
    type: 'media',
    background: bg('solid-black', 0),
    build: () => ({
      title: 'Media',
      type: 'media',
      background: bg('solid-black', 0),
      fields: fields([
        { label: 'Title', value: '', visible: false },
        { label: 'Subtitle', value: '', visible: false },
        { label: 'Body', value: '', visible: false },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
  {
    id: 'custom-split',
    name: 'Custom · Split',
    category: 'blank',
    description: 'Title top, body bottom banner',
    type: 'custom',
    layout: 'banner-bottom',
    bannerHeight: 35,
    background: bg('gradient-broadcast', 40),
    build: () => ({
      title: 'Custom Split',
      type: 'custom',
      layout: 'banner-bottom',
      bannerHeight: 35,
      background: bg('gradient-broadcast', 40),
      fields: fields([
        { label: 'Title', value: 'Headline', size: 'xl' },
        { label: 'Subtitle', value: 'Supporting line', size: 'md', color: '#94a3b8' },
        { label: 'Body', value: 'Details in the banner zone', size: 'md' },
        { label: 'Footer', value: '', visible: false },
      ]),
    }),
  },
];

export const TEMPLATE_CATEGORIES = [
  'all',
  'worship',
  'announcement',
  'banner',
  'scripture',
  'event',
  'ministry',
  'media',
  'blank',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
