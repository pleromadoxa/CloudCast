import type { ComponentType } from 'react';
import type { StudioSceneProps } from './StudioScenes';
import {
  AmberTalkScene,
  BedroomScene,
  ClassicBlueNewsScene,
  ConferenceRoomScene,
  CrimsonRingScene,
  CycloramaScene,
  GlobalNewsArenaScene,
  GreenRoomScene,
  HouseExteriorScene,
  KitchenScene,
  LivingRoomScene,
  NewsroomScene,
  SportsArenaScene,
  TalkShowScene,
  VioletHudScene,
  WeatherCenterScene,
  WorshipStageScene,
  XrConcertScene,
} from './StudioScenes';
import {
  AuctionHouseScene,
  ChurchSanctuaryScene,
  ConcertHallScene,
  FilmNoirScene,
  FitnessStudioScene,
  LibraryStudyScene,
  LuxuryBallroomScene,
  MusicMinistryScene,
  NewsPremiumScene,
  PodcastStudioScene,
  RealEstateScene,
  RooftopTerraceScene,
} from './PhotorealSets';

/**
 * Registry scene id → the component that renders its environment, resolving
 * every screen slot (operator binding → scene default → off).
 *
 * Every id in `sceneRegistry` must have an entry — `sceneCoverage.test.ts`
 * fails if one is missing, because an unmapped id silently renders the blank
 * cyclorama and every new set ends up looking like the same scene.
 *
 * Kept out of `StudioSceneRenderer` so that file stays a component-only module
 * (fast refresh) while the map remains importable by tests.
 */
const SCENE_COMPONENTS: Record<string, ComponentType<StudioSceneProps>> = {
  newsroom: NewsroomScene,
  sports_arena: SportsArenaScene,
  living_room: LivingRoomScene,
  talk_show: TalkShowScene,
  worship_stage: WorshipStageScene,
  weather_center: WeatherCenterScene,
  kitchen_set: KitchenScene,
  bedroom_suite: BedroomScene,
  conference_room: ConferenceRoomScene,
  house_exterior: HouseExteriorScene,
  green_room: GreenRoomScene,
  xr_concert: XrConcertScene,
  cyclorama: CycloramaScene,
  global_news_arena: GlobalNewsArenaScene,
  classic_blue_news: ClassicBlueNewsScene,
  amber_talk_studio: AmberTalkScene,
  crimson_ring_studio: CrimsonRingScene,
  violet_hud_news: VioletHudScene,
  // photorealistic sets
  news_premium: NewsPremiumScene,
  church_sanctuary: ChurchSanctuaryScene,
  music_ministry: MusicMinistryScene,
  luxury_ballroom: LuxuryBallroomScene,
  concert_hall: ConcertHallScene,
  podcast_studio: PodcastStudioScene,
  fitness_studio: FitnessStudioScene,
  real_estate: RealEstateScene,
  auction_house: AuctionHouseScene,
  film_noir: FilmNoirScene,
  rooftop_terrace: RooftopTerraceScene,
  library_study: LibraryStudyScene,
};

/** Registry id → component, exported for the renderer and the coverage test. */
export function sceneComponentFor(sceneId: string): ComponentType<StudioSceneProps> | undefined {
  return SCENE_COMPONENTS[sceneId];
}
