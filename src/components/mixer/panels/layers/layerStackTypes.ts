export type { LayerStackId } from '../../../../types/graphicsStack';

import type { LayerStackId } from '../../../../types/graphicsStack';

export interface LayerStackItem {
  id: LayerStackId;
  zIndex: number;
  label: string;
  sublabel?: string;
  /** Visible on PST preview */
  isPreview: boolean;
  /** On air on PGM */
  isLive: boolean;
  canPreview: boolean;
  canGoLive: boolean;
  canDelete: boolean;
  canReorder: boolean;
}
