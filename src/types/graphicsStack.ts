export type LayerStackId =
  | 'transition'
  | 'breaking'
  | 'live-button'
  | 'lower-third'
  | 'weather'
  | 'scoreboard'
  | 'ad-zone'
  | 'sponsor-bug'
  | 'countdown'
  | 'logo'
  | 'crawler'
  | 'chroma'
  | `image:${string}`
  | `video:${string}`;
