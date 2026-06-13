export interface SolutionPage {
  slug: string;
  title: string;
  headline: string;
  description: string;
  keywords: string[];
  products: string[];
  painPoints: string[];
  benefits: string[];
  workflow: string[];
}

export const SOLUTION_PAGES: SolutionPage[] = [
  {
    slug: 'churches',
    title: 'Church Live Streaming & Worship Production',
    headline: 'Stream every service without a hardware truck',
    description:
      'CloudCast gives churches a browser-based video mixer, worship presentation with scripture lookup, 16-channel audio console, and instant replay — pair volunteer phones as cameras with a 6-digit code and go live to YouTube or Facebook.',
    keywords: [
      'church live streaming',
      'worship broadcast software',
      'church video production',
      'volunteer-friendly live stream',
      'church presentation software',
      'multi-camera church stream',
    ],
    products: ['CloudCast Video Mixer', 'Regal Display', 'CloudCast Audio Mixer', 'CloudCast Replay'],
    painPoints: [
      'Hardware switchers and encoders cost $10,000+ and require trained operators',
      'Volunteer turnover makes complex OBS/vMix setups hard to sustain',
      'Lyrics, scripture, and camera switching live in separate apps',
    ],
    benefits: [
      'Free tier with Regal Mesh — pair phones without cloud fees',
      'Regal Display outputs slides and NKJV/NIV/ESV scripture as a live mixer source',
      'One Universal plan covers video, audio, presentation, and replay from $59/mo',
    ],
    workflow: [
      'Share a 6-digit access code with camera volunteers on CloudCast Video Mobile',
      'Build your worship set in Regal Display with scriptures and lower-thirds',
      'Switch PST/PGM on the Video Mixer and stream to YouTube or Facebook RTMP',
      'Mark replay moments during baptisms or special segments with CloudCast Replay',
    ],
  },
  {
    slug: 'sports',
    title: 'Sports Live Production & Instant Replay',
    headline: 'Multi-cam sports without an OB truck',
    description:
      'Cover games with multiple angles, instant replay, slow-motion review, and one-click PGM push. CloudCast Replay ships with Video Mixer — mark in/out on a rolling buffer and push highlights to air during live broadcasts.',
    keywords: [
      'sports live streaming',
      'instant replay software',
      'multi-camera sports production',
      'high school sports broadcast',
      'college sports live stream',
      'OB truck alternative',
    ],
    products: ['CloudCast Video Mixer', 'CloudCast Replay', 'CloudCast Audio Mixer'],
    painPoints: [
      'Renting OB trucks for a single game costs thousands per day',
      'Consumer streaming tools lack proper replay banks and PGM push',
      'Synchronizing multiple camera angles is manual and error-prone',
    ],
    benefits: [
      'Pro Master supports UHD with up to eleven video inputs including IP cameras',
      'Rolling buffer replay up to 5 minutes with 16 clip banks on Pro Master',
      'Deploy from any laptop — ideal for field-side and gym productions',
    ],
    workflow: [
      'Position cameras and pair each angle via Regal Cloud HD+ on Pro plans',
      'Director switches live action on PST/PGM with multiview monitoring',
      'Replay operator marks in/out and pushes slow-mo clips to program',
      'Stream to YouTube, Twitch, or a custom RTMP destination for league apps',
    ],
  },
  {
    slug: 'news',
    title: 'News Desk & Remote Field Production',
    headline: 'Breaking news switching from any laptop',
    description:
      'Replace rack-mounted switchers for remotes, breaking news, and second-screen feeds. CloudCast Pro Master delivers UHD across multiple channels including USB capture for graphics and replay.',
    keywords: [
      'news broadcast software',
      'remote news production',
      'breaking news live stream',
      'field reporter streaming',
      'news desk switcher',
      'digital news production',
    ],
    products: ['CloudCast Video Mixer', 'CloudCast Replay', 'Regal Prism'],
    painPoints: [
      'Satellite and bonded-cellular packs are expensive for every remote hit',
      'News desks need reliable PST/PGM semantics, not consumer webcam tools',
      'Virtual sets and AR graphics require separate desktop VP platforms',
    ],
    benefits: [
      'Regal Cloud HD+ connects distributed field crews with low latency',
      'Regal Prism adds virtual sets and AR overlays in the browser on Pro Master',
      'Record to Regal Cloud Archive for compliance and clip repurposing',
    ],
    workflow: [
      'Anchor at desk switches between studio USB capture and field Regal Cloud feeds',
      'Graphics operator layers lower-thirds and tickers on the program bus',
      'Field reporters connect via mobile app with a shared access code',
      'Archive the full program recording to cloud storage for VOD and compliance',
    ],
  },
  {
    slug: 'corporate',
    title: 'Corporate Events & Hybrid Conferences',
    headline: 'Keynotes, panels, and hybrid events in one dashboard',
    description:
      'Run town halls, product launches, and hybrid conferences with a professional switcher, presentation feed, and multi-destination RTMP output — no flypack required.',
    keywords: [
      'corporate live streaming',
      'hybrid event production',
      'webinar production switcher',
      'conference live stream',
      'corporate video production cloud',
      'all-hands meeting broadcast',
    ],
    products: ['CloudCast Video Mixer', 'Regal Display', 'CloudCast Audio Mixer', 'Regal Prism'],
    painPoints: [
      'AV vendors charge premium day rates for basic switching and streaming',
      'Slide decks and speaker cameras require separate tools and operators',
      'Hybrid events need reliable failover and professional transitions',
    ],
    benefits: [
      'Browser-native — guest operators can run a show from any laptop in minutes',
      'Regal Display feeds presentation slides directly into the video mixer',
      'Stream to YouTube, custom RTMP, or record for on-demand replay',
    ],
    workflow: [
      'Connect presenter laptop via USB capture and room cameras via mobile pairing',
      'Route Regal Display slides to a dedicated mixer input for seamless switching',
      'Use CloudCast Audio Mixer on Universal for dedicated A1 console and PGM bridge',
      'Record the program to Regal Cloud for post-event VOD distribution',
    ],
  },
];

export function parseSolutionSlug(slug: string | undefined): SolutionPage | null {
  if (!slug) return null;
  return SOLUTION_PAGES.find((s) => s.slug === slug) ?? null;
}

export function solutionPath(slug: string): string {
  return `/for/${slug}`;
}
