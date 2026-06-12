import type { CloudCastProductId } from '../types/products';
import {
  AUDIO_MIXER_CHANNELS,
  PRODUCT_TIER_PRICES,
  REPLAY_BANKS,
  REPLAY_BUFFER_SECONDS,
  SYMPHONY_CLOUD_PROJECTS,
  SYMPHONY_TRACKS,
  UNIVERSAL_PLAN_PRICE_CENTS,
} from './products';

export interface ProductGuideSection {
  id: CloudCastProductId;
  overview: string;
  problems: { title: string; description: string }[];
  costEffectiveness: {
    summary: string;
    comparisonPoints: string[];
    recommendedTier: string;
    monthlyRange: string;
  };
  howToUse: { step: number; title: string; description: string }[];
  liveScenario: {
    title: string;
    context: string;
    workflow: string[];
    outcome: string;
  };
  keyCapabilities: string[];
}

export const PRODUCT_GUIDE_SECTIONS: ProductGuideSection[] = [
  {
    id: 'video_mixer',
    overview:
      'CloudCast Video Mixer is a browser-based broadcast switcher built for the same PST/PGM workflow professionals use on hardware switchers. It routes multiple camera feeds — mobile devices over Regal Mesh or Regal Cloud, USB capture cards, and IP camera URLs — through preview and program buses, applies transitions, overlays, chroma key, and multiview, then streams to YouTube, Twitch, or custom RTMP destinations. Your crew opens one dashboard from any laptop; there is no flypack, no SDI router, and no dedicated encoder rack to ship.',
    problems: [
      {
        title: 'Hardware switchers are expensive and immobile',
        description:
          'A mid-range hardware switcher plus encoder and multiview monitor easily exceeds $15,000–$40,000 in capital expense, and it lives in one truck or studio. CloudCast replaces that stack with a browser tab you can run from a production laptop on location or at a desk.',
      },
      {
        title: 'Remote and distributed crews are hard to coordinate',
        description:
          'Field reporters and second-unit cameras traditionally need bonded cellular packs or complex VPN setups. Regal Mesh pairs phones with a 6-digit access code on the free tier; Pro and Pro Master upgrade to Regal Cloud HD+ for global low-latency delivery without exposing infrastructure details to your team.',
      },
      {
        title: 'Streaming setup is fragmented',
        description:
          'Many teams stitch together OBS, vMix, separate encoders, and graphics machines. CloudCast unifies switching, monitoring, overlays, and multi-destination streaming in one production surface so operators are not alt-tabbing between five apps during a live show.',
      },
      {
        title: 'Scaling inputs means buying new hardware',
        description:
          'Adding cameras on a hardware switcher often means new cards, cables, and rack space. CloudCast scales from two mobile cameras on Free to eleven total inputs on Pro Master — including USB capture and IP camera URLs — through plan upgrades, not new boxes.',
      },
    ],
    costEffectiveness: {
      summary:
        'Start at $0/month with Regal Mesh and a two-camera workflow. Pro at $29/month unlocks HD streaming via Regal Cloud and five video inputs — a fraction of the monthly cost of renting OB gear for a single remote. Pro Master at $79/month delivers UHD, eleven inputs, and priority support; CloudCast Universal at $119/month includes Video Mixer at Pro Master tier plus Audio, Symphony, and Replay.',
      comparisonPoints: [
        'Typical OB truck rental for one sports event: $2,500–$8,000/day vs. CloudCast Pro Master at ~$2.63/day',
        'Hardware switcher amortized over 36 months: $400–$1,100/month before encoders, storage, or support contracts',
        'No depreciation, maintenance, or shipping insurance — subscription cost is predictable and cancellable',
        'Free tier validates your workflow with real PST/PGM production before any spend',
      ],
      recommendedTier:
        'Churches, schools, and indie streamers: Free or Pro. Regional networks, sports, and multi-cam live events: Pro Master or Universal.',
      monthlyRange: `Free · Pro ${formatGuidePrice(PRODUCT_TIER_PRICES.pro)}/mo · Pro Master ${formatGuidePrice(PRODUCT_TIER_PRICES.pro_master)}/mo`,
    },
    howToUse: [
      {
        step: 1,
        title: 'Create a session and share your access code',
        description:
          'Sign in, open the Video Mixer dashboard, and start a new production session. CloudCast generates a 6-character access code. Share it with camera operators running the CloudCast Video Mobile app.',
      },
      {
        step: 2,
        title: 'Pair cameras and verify PST',
        description:
          'As each device connects, its feed appears in your source list. Select a source for Preview (PST), check framing and exposure, then take it to Program (PGM) with a cut or transition. Use multiview to watch all feeds simultaneously.',
      },
      {
        step: 3,
        title: 'Add graphics, audio, and stream destinations',
        description:
          'Layer lower-thirds and logos from the graphics panel, route embedded audio or bridge to CloudCast Audio Mixer on Universal, configure YouTube/Twitch/custom RTMP outputs, and confirm your stream health indicators before going on air.',
      },
      {
        step: 4,
        title: 'Go live and record',
        description:
          'Toggle On Air when ready. Operators continue switching through the show; recordings land in Regal Cloud storage on paid tiers (50GB Pro, 100GB Pro Master/Universal) for post-production or compliance archives.',
      },
    ],
    liveScenario: {
      title: 'Friday night high school football — 4-camera live stream',
      context:
        'Apex Sports Media covers a regional playoff game with two sideline iPhones, an end-zone Android phone, and a USB capture feed from the press-box PTZ camera. The director runs CloudCast from a MacBook Pro in the press box; the stream goes to YouTube and the school\'s website via custom RTMP.',
      workflow: [
        '10:00 AM — Producer creates session, texts access code to three field operators; USB PTZ is added via Devices panel.',
        '6:30 PM — Pre-game: director builds a multiview, tests transitions, loads team lower-thirds and sponsor bugs.',
        '7:00 PM — Kickoff: Camera 1 (wide) on PGM, Camera 2 (sideline) in PST for replay angles; director cuts on action.',
        'Halftime — Switch to pre-built graphics scene; push interview mic from press box without stopping the stream.',
        'Final whistle — Fade to scoreboard graphic; recording auto-saves to Regal Cloud for highlight reels.',
      ],
      outcome:
        'The production delivered a four-angle HD broadcast without an OB truck. Total software cost: $29/month on Pro — less than one hour of traditional gear rental. The same access code workflow repeats next week with zero reconfiguration.',
    },
    keyCapabilities: [
      'PST/PGM monitors with cut, fade, and transition controls',
      'Multiview, PiP, chroma key, and on-air graphics',
      'Regal Mesh (Free) and Regal Cloud HD+ (Pro/Pro Master)',
      'Multi-stream to YouTube, Twitch, and custom RTMP',
      'USB capture and IP camera URL inputs on paid tiers',
      'Integration with CloudCast Replay and Audio Mixer on Universal',
    ],
  },
  {
    id: 'audio_mixer',
    overview:
      'CloudCast Audio Mixer is a 16-fader digital broadcast console inspired by professional live-sound workflows. It provides per-channel solo and mute, monitor and PGM master buses, live spectrum metering, and Fat Channel processing on Pro Master. Phone, USB, and alternative inputs arrive through the CloudCast Audio Mobile companion app via access-code pairing. On CloudCast Universal, a bridge code links the audio console to the Video Mixer so one engineer can mix sound while another switches picture — or one operator runs both from linked dashboards.',
    problems: [
      {
        title: 'Dedicated audio consoles do not travel well',
        description:
          'A 16-channel digital mixer, stage box, and snake represent thousands in gear and hours of cabling. CloudCast Audio runs in the browser with the same fader workflow, so a FO H engineer can mix from a laptop backstage or a broadcast booth.',
      },
      {
        title: 'Video productions treat audio as an afterthought',
        description:
          'Embedded camera audio is inconsistent and cannot be solo\'d per source during a live show. CloudCast Audio gives you independent channel control, proper monitor routing, and PGM master output that can feed your video program or stream.',
      },
      {
        title: 'Remote talent and phone feeds are awkward to integrate',
        description:
          'Call-in guests and field reporters usually require separate interfaces and mix-minus setups. CloudCast Audio Mobile turns phones into broadcast inputs that join your session with the same access code model as video — no custom SIP bridge required for basic integrations.',
      },
      {
        title: 'Paying for unused channels',
        description:
          'Hardware consoles are fixed capacity. CloudCast renders 16 faders always, but plan tiers unlock 4, 8, or 16 active channels — you pay for the capacity you need and upgrade when the show grows.',
      },
    ],
    costEffectiveness: {
      summary:
        'Free tier covers 4 channels for small streams and podcasts. Pro ($29/month) unlocks 8 channels with advanced routing; Pro Master ($79/month) delivers the full 16-channel console with Fat Channel controls. Compared to a $3,000–$8,000 digital mixer plus stage I/O, CloudCast Audio pays for itself in the first one or two events you would otherwise rent or buy hardware for.',
      comparisonPoints: [
        '16-channel digital mixer rental: $150–$400/day vs. Pro Master at ~$2.63/day',
        'No snake runs, stage box rental, or analog splitters for simple productions',
        'Universal ($119/month) includes audio at Pro Master tier plus video, DAW, and replay — replacing four separate tool subscriptions',
        'Inactive faders stay visible but locked on lower tiers, so operators learn the full console layout before upgrading',
      ],
      recommendedTier:
        'Podcasts and single-room streams: Free or Pro. Houses of worship, conferences, and broadcast audio: Pro Master or Universal.',
      monthlyRange: `Free (4 ch) · Pro ${formatGuidePrice(PRODUCT_TIER_PRICES.pro)}/mo (8 ch) · Pro Master ${formatGuidePrice(PRODUCT_TIER_PRICES.pro_master)}/mo (16 ch)`,
    },
    howToUse: [
      {
        step: 1,
        title: 'Open the Audio Mixer dashboard',
        description:
          'From the product hub or /audio, start a session. Note your access code for mobile audio sources and, on Universal, generate a bridge code to link with the Video Mixer.',
      },
      {
        step: 2,
        title: 'Pair inputs and assign channels',
        description:
          'Connect CloudCast Audio Mobile devices or other supported inputs. Each source maps to a fader slot. Set initial gain, engage solo to check one source in headphones, and mute channels not in use.',
      },
      {
        step: 3,
        title: 'Build your mix on the monitor bus',
        description:
          'Use the monitor section to hear what the operator needs — often a blend different from PGM. Adjust EQ and dynamics on Pro Master via Fat Channel when sources need polish before they hit air.',
      },
      {
        step: 4,
        title: 'Ride PGM master for the program',
        description:
          'Push faders for music beds, mics, and remote feeds into the PGM bus. On Universal, bridged audio feeds the Video Mixer program; otherwise route PGM to your stream encoder or recording path.',
      },
    ],
    liveScenario: {
      title: 'Sunday service — band, spoken word, and stream mix',
      context:
        'Horizon Community Church runs a 90-minute service with a five-piece band, pastor wireless, audience ambient, and a phone feed from a missionary calling in from overseas. The audio engineer uses CloudCast Audio on a Windows laptop; video switches separately on Universal with a bridge code.',
      workflow: [
        '8:00 AM — Engineer opens Audio Mixer, pairs two Audio Mobile phones: one on the pulpit backup mic, one on the room ambient capture.',
        '8:45 AM — Sound check: solo each channel, set high-pass on pastor mic, blend drums and keys on monitor bus while musicians hear themselves.',
        '9:00 AM — Service start: music mix on PGM faders; engineer rides vocal and keeps ambient low under spoken segments.',
        '9:40 AM — Missionary call-in joins on phone channel; engineer ducks music, brings phone feed to PGM, video director takes phone caller full-screen via bridge sync.',
        '10:30 AM — Post-service: PGM recording saved; same session preset reused next Sunday with one-click channel recall.',
      ],
      outcome:
        'One volunteer engineer delivered broadcast-quality audio for in-room stream and archived recording. Pro Master at $79/month replaced a rented digital mixer ($200/weekend) and eliminated a separate phone hybrid box.',
    },
    keyCapabilities: [
      `${AUDIO_MIXER_CHANNELS.pro_master} fader slots (plan unlocks ${AUDIO_MIXER_CHANNELS.free}/${AUDIO_MIXER_CHANNELS.pro}/${AUDIO_MIXER_CHANNELS.pro_master} active channels)`,
      'Monitor bus + PGM master with solo/mute per channel',
      'Live spectrum display and input metering',
      'CloudCast Audio Mobile pairing via access code',
      'Fat Channel processing on Pro Master',
      'Video Mixer bridge on CloudCast Universal',
    ],
  },
  {
    id: 'symphony_studio',
    overview:
      'CloudCast Symphony is a full browser-based digital audio workstation (DAW). Arrange multi-track projects on a timeline, edit MIDI in the piano roll, browse loops, automate mix parameters, and export mixdowns — without installing plugins or managing local project files. Built-in synthesizer and string libraries cover common production needs; projects sync to Regal Cloud Archive so your team can resume work from any machine. Symphony complements live broadcast products: produce stingers, beds, and theme packages in Symphony, then play them in Video Mixer or route through Audio Mixer on Universal.',
    problems: [
      {
        title: 'Traditional DAWs tie you to one machine',
        description:
          'Pro Tools, Logic, and Ableton projects live on a local drive. Collaborators email stems; versions diverge. Symphony stores projects in Regal Cloud Archive with tier-based quotas (3 to 100 projects), so opening the DAW from a new laptop does not mean copying terabytes of audio.',
      },
      {
        title: 'Licensing and plugin costs add up',
        description:
          'Professional music production often requires expensive DAW licenses, virtual instruments, and loop subscriptions. Symphony includes core instruments, loop browser, and mixdown export in the subscription — no per-plugin invoices.',
      },
      {
        title: 'Broadcast teams outsource simple audio tasks',
        description:
          'A 10-second news sting or podcast intro should not require booking a studio day. Symphony lets producers on your staff build broadcast-ready assets in-house and export WAV mixdowns for immediate air.',
      },
      {
        title: 'Hardware requirements block remote creators',
        description:
          'Heavy native DAWs demand powerful CPUs and large SSDs. Symphony runs in the browser with Web Audio engines, lowering the barrier for journalists, editors, and indie creators who already live in CloudCast for video.',
      },
    ],
    costEffectiveness: {
      summary:
        'Free tier includes 4 tracks and 3 cloud projects — enough to learn the workflow and produce short stings. Pro ($29/month) expands to 16 tracks and 25 cloud projects with full synth libraries and automation. Pro Master ($79/month) delivers 32 tracks and 100 archive projects. A standalone DAW + sample library subscription often exceeds $30–$50/month before cloud backup or collaboration tools.',
      comparisonPoints: [
        `Track limits scale clearly: ${SYMPHONY_TRACKS.free} / ${SYMPHONY_TRACKS.pro} / ${SYMPHONY_TRACKS.pro_master} tracks by tier`,
        `Regal Cloud Archive: ${SYMPHONY_CLOUD_PROJECTS.free} / ${SYMPHONY_CLOUD_PROJECTS.pro} / ${SYMPHONY_CLOUD_PROJECTS.pro_master} projects included`,
        'No separate iLok, upgrade path, or version-lock — subscription tier is the only gate',
        'Universal bundles Symphony at Pro Master with live production tools for one $119/month line item',
      ],
      recommendedTier:
        'Podcast producers and short-form stingers: Pro. Music beds, full arrangements, and archive-heavy teams: Pro Master or Universal.',
      monthlyRange: `Free (${SYMPHONY_TRACKS.free} tracks) · Pro ${formatGuidePrice(PRODUCT_TIER_PRICES.pro)}/mo (${SYMPHONY_TRACKS.pro} tracks) · Pro Master ${formatGuidePrice(PRODUCT_TIER_PRICES.pro_master)}/mo (${SYMPHONY_TRACKS.pro_master} tracks)`,
    },
    howToUse: [
      {
        step: 1,
        title: 'Create a project in Symphony',
        description:
          'Open /symphony, start a new project, and choose tempo and time signature. Name it clearly — it saves to Regal Cloud Archive automatically on paid tiers.',
      },
      {
        step: 2,
        title: 'Build your arrangement',
        description:
          'Add tracks from the loop browser or instrument library. Drag regions on the timeline, open the piano roll for MIDI edits, and duplicate sections for verses and choruses.',
      },
      {
        step: 3,
        title: 'Mix with automation',
        description:
          'Adjust levels, pan, and automation lanes per track. Use the effects panel where available and preview the full mix from the transport bar before export.',
      },
      {
        step: 4,
        title: 'Export mixdown for air',
        description:
          'Bounce to WAV via mixdown export. Import the file into Video Mixer as a media source, play through Audio Mixer, or archive in Regal Cloud for compliance.',
      },
    ],
    liveScenario: {
      title: 'Local news open — custom theme in under two hours',
      context:
        'Vertex Studio Group rebrands a morning news block and needs a 15-second open, 8-second bumper, and 30-second weather bed by tomorrow\'s debut. A producer uses Symphony on a Chromebook between edit sessions — no studio booking.',
      workflow: [
        'Hour 1 — Producer creates project at 120 BPM, lays drum loop from browser, adds string pad and bass from built-in libraries.',
        'Hour 1.5 — Piano roll melody for the sting; automation dip on bar 7 for voice-over ducking in the open.',
        'Hour 2 — Mixdown export to WAV; uploads to Video Mixer media bin; director drops open into the rundown.',
        'Next morning — Live debut: director triggers open from Video Mixer; same project cloned in Symphony for evening show variant.',
      ],
      outcome:
        'Custom branded audio delivered same day on Pro ($29/month). Outsourcing the package would have cost $800–$2,000 and missed the launch window. Project remains in Regal Cloud Archive for future edits.',
    },
    keyCapabilities: [
      'Multi-track timeline with loop browser',
      'Piano roll MIDI editor',
      'Web Audio synthesizers and string libraries',
      'Automation lanes and mixdown export',
      'Regal Cloud Archive project sync',
      'Pairs with Video and Audio products on Universal',
    ],
  },
  {
    id: 'instant_replay',
    overview:
      'CloudCast Replay is an instant replay and clip engine for live events. It maintains a rolling buffer of your live program feed, lets operators mark in and out points in real time, review footage with frame-step and slow motion, organize clips into replay banks, and push the winning angle to PGM in one click from the Video Mixer. Built for sports, news, esports, and any show where seconds matter, Replay shares the same CloudCast session as your video production so clip and switch happen in one ecosystem.',
    problems: [
      {
        title: 'Dedicated replay servers cost six figures',
        description:
          'Traditional instant replay systems (EVS-class) require specialized hardware, trained operators, and maintenance contracts. CloudCast Replay delivers rolling buffer, mark in/out, and PGM push in software — accessible to school athletics and regional broadcasters, not only tier-one sports networks.',
      },
      {
        title: 'Manual clip workflows are too slow for live TV',
        description:
          'Recording to disk and editing in post misses the moment. Replay captures continuously; operators mark the play as it happens and air the clip within seconds while the crowd is still reacting.',
      },
      {
        title: 'Multi-angle sync is error-prone',
        description:
          'Without a unified session, syncing angles from separate recorders in post wastes hours. Replay ingests the live program buffer and supports multi-camera tagging on Pro+ tiers so the correct angle reaches air fast.',
      },
      {
        title: 'Replay is often siloed from the switcher',
        description:
          'Many workflows export clips from one machine and import to another. CloudCast Replay integrates with Video Mixer — one click pushes a vetted clip to PGM without file transfers or USB drives at the director\'s desk.',
      },
    ],
    costEffectiveness: {
      summary:
        'CloudCast Replay is included with Video Mixer at every tier — no separate subscription. Free Video Mixer includes 2 replay banks and a 30-second rolling buffer. Video Mixer Pro expands to 8 banks and 120 seconds with slow-mo export. Video Mixer Pro Master delivers 16 banks, a 5-minute buffer, and multi-angle sync. Dedicated replay hardware rentals often start at $1,500/day; Pro Master Video Mixer costs less than two lattes per day and includes Replay.',
      comparisonPoints: [
        `Buffer length: ${REPLAY_BUFFER_SECONDS.free}s / ${REPLAY_BUFFER_SECONDS.pro}s / ${REPLAY_BUFFER_SECONDS.pro_master}s by Video Mixer tier`,
        `Replay banks: ${REPLAY_BANKS.free} / ${REPLAY_BANKS.pro} / ${REPLAY_BANKS.pro_master} clip slots`,
        'PGM push is included — no separate playout server',
        'Universal includes Replay at Pro Master alongside Video, Audio, and Symphony',
      ],
      recommendedTier:
        'Club sports and single-camera streams: Video Mixer Free or Pro. Multi-cam sports, news desks, and esports: Video Mixer Pro Master or Universal.',
      monthlyRange: `Included with Video Mixer — Free (${REPLAY_BUFFER_SECONDS.free}s buffer) · Pro ${formatGuidePrice(PRODUCT_TIER_PRICES.pro)}/mo · Pro Master ${formatGuidePrice(PRODUCT_TIER_PRICES.pro_master)}/mo`,
    },
    howToUse: [
      {
        step: 1,
        title: 'Run Replay alongside your Video Mixer session',
        description:
          'Open Replay from the product hub while Video Mixer is live. The rolling buffer captures your program feed automatically once the session is on air.',
      },
      {
        step: 2,
        title: 'Mark in and out on the live action',
        description:
          'When a key moment happens, mark IN immediately, then mark OUT after the play completes. The clip lands in your active replay bank with timestamp metadata.',
      },
      {
        step: 3,
        title: 'Review with frame-step and slow motion',
        description:
          'Scrub the clip, step frame-by-frame to find the perfect entry point, and preview slow-motion segments before committing to air — critical for controversial calls and highlight packages.',
      },
      {
        step: 4,
        title: 'Push to PGM',
        description:
          'Select the vetted clip and push to PGM. Video Mixer takes the replay full-screen or in PiP per your preset; return to live cameras when the clip ends.',
      },
    ],
    liveScenario: {
      title: 'Regional basketball tournament — highlight on air in 8 seconds',
      context:
        'Apex Sports Media covers a semi-final with four cameras on CloudCast Video Mixer (Pro Master) and Replay on the same Universal subscription. A replay operator sits next to the director; both share the live session.',
      workflow: [
        'Q4 — Tie game: star player hits a three-pointer at the buzzer; replay operator hits IN at the release, OUT after the celebration.',
        'Buffer holds 5 minutes (Pro Master); operator frame-steps to the exact release frame and trims the clip.',
        'Director calls "Replay 1"; operator pushes clip to PGM — audience sees slow-motion buzzer-beater 8 seconds after the live moment.',
        'Clip stays in Bank 3 for post-game social export; operator tags alternate angle from Camera 2 for second replay.',
      ],
      outcome:
        'Broadcast-quality instant replay without EVS hardware. Universal at $119/month covered video, replay, and audio for the entire tournament weekend — less than 8% of a single-day dedicated replay rental.',
    },
    keyCapabilities: [
      `${REPLAY_BANKS.pro_master} replay banks on Pro Master (tiered from ${REPLAY_BANKS.free})`,
      `${REPLAY_BUFFER_SECONDS.pro_master}s rolling buffer on Pro Master`,
      'Mark in/out, frame-step, and slow-motion review',
      'One-click PGM push from Video Mixer',
      'Slow-mo clip export and multi-camera tagging on Pro+',
      'Multi-angle sync on Pro Master',
    ],
  },
];

function formatGuidePrice(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(0)}`;
}

export const WHY_CLOUDCAST_POINTS = [
  {
    title: 'One platform, four professional tools',
    description:
      'Video switching, broadcast audio, music production, and instant replay are separate products with dedicated dashboards — subscribe only to what you need, or unlock CloudCast Universal for Pro Master features on every product at $119/month.',
  },
  {
    title: 'Built by Quantum Regal for real broadcast workflows',
    description:
      'CloudCast by Quantum Regal is engineered by Quantum Regal Digital Labs — not a generic streaming widget. PST/PGM semantics, replay banks, Fat Channel audio, and DAW export mirror the language your directors, A1s, and producers already speak.',
  },
  {
    title: 'Regal Mesh and Regal Cloud without the complexity',
    description:
      'Free tier crews connect over Regal Mesh with a simple access code. Paid tiers upgrade to Regal Cloud HD+ for global delivery. Your team never manages CDN tokens or encoder firmware — CloudCast selects the right pipeline from the plan.',
  },
  {
    title: 'Browser-native means zero install friction',
    description:
      'Open a URL, sign in, go live. No driver conflicts, no macOS/Windows version lock, no IT tickets for plugin installs. Guest operators can run a show from a borrowed laptop in minutes.',
  },
  {
    title: 'Predictable subscription economics',
    description:
      'Replace unpredictable capital expenditure and rental quotes with monthly tiers you can scale up for playoff season and down in the off-season. Start free, prove the workflow, upgrade when revenue or audience demands it.',
  },
  {
    title: 'Mobile companion apps included in the ecosystem',
    description:
      'CloudCast Video Mobile and CloudCast Audio Mobile turn phones into broadcast-grade sources. Access codes pair devices in seconds — the same model for a volunteer church stream and a regional sports broadcast.',
  },
  {
    title: 'Regal Cloud Archive ties production together',
    description:
      'Video recordings, Symphony projects, and replay clips live in one archive strategy on paid tiers. Compliance, highlights, and rebrands do not require hunting across USB drives and personal Dropbox folders.',
  },
  {
    title: 'Support that understands live production',
    description:
      'Pro Master and Universal include priority support from a team that builds broadcast software — not a generic help desk reading scripts. When you are on air, that difference matters.',
  },
] as const;

export const UNIVERSAL_VALUE_SUMMARY = {
  price: formatGuidePrice(UNIVERSAL_PLAN_PRICE_CENTS),
  headline: 'All four products · Pro Master on every product',
  bullets: [
    'Video Mixer: 11 inputs, UHD, multi-stream, 100GB storage',
    'Audio Mixer: 16 active channels, Fat Channel, bridge to video',
    'Symphony: 32 tracks, 100 Regal Cloud Archive projects',
    'Replay: 16 banks, 5-minute buffer, multi-angle sync',
    'One invoice instead of four Pro Master subscriptions ($316/mo separately)',
  ],
  savingsNote:
    'Universal at $119/month saves $197/month versus subscribing to Video, Audio, Symphony, and Replay each at Pro Master ($79 × 4 = $316).',
};
