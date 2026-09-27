export type PrismProductionMode = 'virtual_studio' | 'augmented_reality' | 'xr_extension';

export type VirtualSetEnvironment =
  | 'news_studio'
  | 'corporate'
  | 'outdoor_ar'
  | 'broadcast_desk'
  | 'xr_stage'
  | 'newsroom_full'
  | 'church_stage'
  | 'kitchen_set'
  | 'furnished_living'
  | 'furnished_bedroom'
  | 'talk_show'
  | 'conference_room'
  | 'residential_exterior'
  | 'news_premium'
  | 'church_sanctuary'
  | 'music_ministry'
  | 'luxury_ballroom'
  | 'concert_hall'
  | 'podcast_studio'
  | 'fitness_studio'
  | 'real_estate'
  | 'auction_house'
  | 'film_noir'
  | 'rooftop_terrace'
  | 'library_study';

export interface VirtualSetDefinition {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'pro' | 'pro_master';
  mode: PrismProductionMode[];
  environment: VirtualSetEnvironment;
}

export const VIRTUAL_SETS: VirtualSetDefinition[] = [
  {
    id: 'news_studio',
    name: 'News Studio',
    description: 'Classic broadcast desk with LED backdrop and floor reflection',
    tier: 'free',
    mode: ['virtual_studio', 'augmented_reality'],
    environment: 'news_studio',
  },
  {
    id: 'newsroom_full',
    name: 'Full Newsroom',
    description: 'Wide newsroom floor with monitor walls and anchor zone',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'newsroom_full',
  },
  {
    id: 'corporate',
    name: 'Corporate Boardroom',
    description: 'Clean glass-and-steel executive backdrop for presentations',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'corporate',
  },
  {
    id: 'conference_room',
    name: 'Conference Room',
    description: 'Meeting room with carpet floors, recessed lighting, and glass accent wall',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'conference_room',
  },
  {
    id: 'furnished_living',
    name: 'Living Room',
    description: 'Warm residential living space with photoreal PBR materials, hardwood floors, and studio lighting',
    tier: 'free',
    mode: ['virtual_studio'],
    environment: 'furnished_living',
  },
  {
    id: 'furnished_bedroom',
    name: 'Bedroom Suite',
    description: 'Furnished bedroom set for home and lifestyle production',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'furnished_bedroom',
  },
  {
    id: 'kitchen_set',
    name: 'Kitchen Studio',
    description: 'Modern kitchen backdrop for cooking and lifestyle segments',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'kitchen_set',
  },
  {
    id: 'church_stage',
    name: 'Church Stage',
    description: 'Worship stage with warm lighting and elevated platform',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'church_stage',
  },
  {
    id: 'outdoor_ar',
    name: 'Outdoor AR Plaza',
    description: 'Augmented reality overlay — virtual graphics composited over live camera',
    tier: 'pro',
    mode: ['augmented_reality', 'xr_extension'],
    environment: 'outdoor_ar',
  },
  {
    id: 'broadcast_desk',
    name: 'Sports Desk',
    description: 'Dynamic sports broadcast set with animated lower-thirds zone',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'broadcast_desk',
  },
  {
    id: 'talk_show',
    name: 'Talk Show Stage',
    description: 'Interview stage with guest seating and theatrical lighting',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'talk_show',
  },
  {
    id: 'residential_exterior',
    name: 'House Exterior',
    description: 'Outdoor residential backdrop with lawn and sky',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'residential_exterior',
  },
  {
    id: 'xr_stage',
    name: 'XR LED Stage',
    description: 'Extended reality stage with set extension and color-calibrated walls',
    tier: 'pro_master',
    mode: ['virtual_studio', 'xr_extension'],
    environment: 'xr_stage',
  },
  {
    id: 'news_premium',
    name: 'News Studio Premium',
    description: 'Flagship holographic news studio with floating glass desk, triple LED wall and cyan accent lighting',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'news_premium',
  },
  {
    id: 'church_sanctuary',
    name: 'Church Sanctuary',
    description: 'Warm worship sanctuary with wooden pews, marble altar, stained-glass window and pendant lighting',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'church_sanctuary',
  },
  {
    id: 'music_ministry',
    name: 'Music Ministry Stage',
    description: 'Dynamic worship band stage with LED floor panels, projection wall and violet haze beams',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'music_ministry',
  },
  {
    id: 'luxury_ballroom',
    name: 'Luxury Ballroom',
    description: 'Opulent ballroom with crystal chandeliers, gold-inlaid marble, ornate wall frames and velvet drapes',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'luxury_ballroom',
  },
  {
    id: 'concert_hall',
    name: 'Concert Hall',
    description: 'Arena-scale concert venue with tiered risers, professional lighting truss and large LED backdrop',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'concert_hall',
  },
  {
    id: 'podcast_studio',
    name: 'Podcast Studio',
    description: 'Intimate two-host podcast booth with acoustic panels, boom mics and LED accent strips',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'podcast_studio',
  },
  {
    id: 'fitness_studio',
    name: 'Fitness Studio',
    description: 'Bright energetic fitness set with mirrored wall, open floor and equipment rack',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'fitness_studio',
  },
  {
    id: 'real_estate',
    name: 'Real Estate Showcase',
    description: 'Professional property-listing presentation set with display wall and modern furniture',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'real_estate',
  },
  {
    id: 'auction_house',
    name: 'Auction House',
    description: 'Prestigious auction podium with display cases, warm spotlighting and mahogany desk',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'auction_house',
  },
  {
    id: 'film_noir',
    name: 'Film Noir Stage',
    description: 'Cinematic noir set with dramatic chiaroscuro lighting, venetian shadows and smoky haze',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'film_noir',
  },
  {
    id: 'rooftop_terrace',
    name: 'Rooftop Terrace',
    description: 'Open-air rooftop with patio furniture, string lights, urban skyline backdrop and planters',
    tier: 'pro',
    mode: ['virtual_studio'],
    environment: 'rooftop_terrace',
  },
  {
    id: 'library_study',
    name: 'Library Study',
    description: 'Stately library with floor-to-ceiling bookshelves, leather chairs and brass-accented oak desk',
    tier: 'pro_master',
    mode: ['virtual_studio'],
    environment: 'library_study',
  },
];

export function setsForPlan(planId: string, maxSets: number): VirtualSetDefinition[] {
  const tierOrder = { free: 0, pro: 1, pro_master: 2, universal: 2 };
  const userTier = tierOrder[planId as keyof typeof tierOrder] ?? 0;
  return VIRTUAL_SETS.filter((s) => tierOrder[s.tier] <= userTier).slice(0, maxSets === 99 ? undefined : maxSets);
}
