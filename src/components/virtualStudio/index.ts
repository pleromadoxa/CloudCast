/**
 * Regal Prism photoreal virtual studio — public surface.
 *
 * `VirtualStudioStage` is the drop-in replacement for the classic virtual
 * scene: a photorealistic, Aximetry-style production environment with ready
 * scenes, live-feed screens, LED walls, banners and replaceable backdrops.
 */
export { VirtualStudioStage, type VirtualStudioStageProps } from './VirtualStudioStage';
export { StudioStage, type StudioStageProps } from './StudioStage';
export { StudioSceneRenderer, type StudioSceneRendererProps } from './StudioSceneRenderer';
export { TalentPlane, type TalentPlaneProps } from './TalentPlane';
export { ScreenSurface, type ScreenSurfaceProps } from './ScreenSurface';
export { useStudioTexture } from './useStudioTexture';
export {
  Television,
  FramedMonitor,
  VideoWall,
  CurvedVideoWall,
  RibbonBanner,
  StandingBanner,
} from './fixtures/screens';
export {
  RoomShell,
  CycloramaShell,
  BackdropPlane,
  WindowFrame,
  AccentWall,
} from './fixtures/architecture';
export * from './scenes/StudioScenes';
