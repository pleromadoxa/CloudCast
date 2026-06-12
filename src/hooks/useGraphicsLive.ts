import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { DashboardControls } from '../types/controls';
import type { LayerStackId } from '../types/graphicsStack';
import type { LowerThirdTemplateId, SavedLowerThirdPreset, TransitionGraphicType } from '../types/overlays';
import {
  DEFAULT_BREAKING,
  DEFAULT_CRAWLER,
  DEFAULT_LIVE_BUTTON,
  DEFAULT_PROGRAM_LOGO,
} from '../types/overlays';
import { removeStackId } from '../lib/graphicsStackOrder';
import { getLowerThirdSampleText, resolveLowerThirdCustomization } from '../lib/lowerThirdTemplates';
import {
  cloneLayerSettings,
  hasLivePgmGraphics,
  normalizeLayerSettings,
  pickBreakingFields,
  pickCrawlerFields,
  pickLiveButtonFields,
  pickLowerThirdFields,
  pickLogoFields,
  syncLivePgmGraphics,
} from '../lib/layerSettings';
import { saveOverlayLayers } from '../lib/overlayStorage';

type SetControls = Dispatch<SetStateAction<DashboardControls>>;

function persistLayers(layers: DashboardControls['layers']) {
  saveOverlayLayers({
    imageOverlays: layers.imageOverlays,
    lowerThirdTemplate: layers.lowerThirdTemplate,
    lowerThirdCustomization: layers.lowerThirdCustomization,
    lowerThirdPresetId: layers.lowerThirdPresetId,
    lowerThirdText: layers.lowerThirdText,
    lowerThirdSubtext: layers.lowerThirdSubtext,
    showLowerThird: layers.showLowerThird,
    programLogo: layers.programLogo,
    crawler: layers.crawler,
    breakingNews: layers.breakingNews,
    showLiveButton: layers.showLiveButton,
    liveButton: layers.liveButton,
    graphicsStackOrder: layers.graphicsStackOrder,
  });
}

export function useGraphicsLive(setControls: SetControls) {
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  const patchLayers = useCallback(
    (partial: Partial<DashboardControls['layers']>) => {
      setControls((prev) => {
        const layers = normalizeLayerSettings({ ...prev.layers, ...partial });
        persistLayers(layers);

        let pgmLayers = normalizeLayerSettings(prev.pgmLayers);
        if (hasLivePgmGraphics(prev.pgmLayers)) {
          pgmLayers = syncLivePgmGraphics(layers, prev.pgmLayers);
        }

        return pgmLayers === prev.pgmLayers ? { ...prev, layers } : { ...prev, layers, pgmLayers };
      });
    },
    [setControls],
  );

  const lowerThirdIsLive = useCallback(
    (pgm: DashboardControls['pgmLayers']) => pgm.showLowerThird,
    [],
  );

  const toggleLowerThirdLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickLowerThirdFields(prev.layers) }))
          : { ...prev.pgmLayers, showLowerThird: false },
      }));
    },
    [setControls],
  );

  const applyLowerThirdAndLive = useCallback(
    (templateId: LowerThirdTemplateId, withSample = true) => {
      const sample = withSample ? getLowerThirdSampleText(templateId) : null;
      setControls((prev) => {
        const layers = normalizeLayerSettings({
          ...prev.layers,
          lowerThirdTemplate: templateId,
          lowerThirdCustomization: resolveLowerThirdCustomization(templateId),
          lowerThirdPresetId: null,
          showLowerThird: true,
          lowerThirdText: sample?.title ?? prev.layers.lowerThirdText,
          lowerThirdSubtext: sample?.sub ?? prev.layers.lowerThirdSubtext,
        });
        persistLayers(layers);
        return {
          ...prev,
          layers,
          pgmLayers: syncLivePgmGraphics(layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickLowerThirdFields(layers) })),
        };
      });
    },
    [setControls],
  );

  const applySavedPreset = useCallback(
    (preset: SavedLowerThirdPreset, goLive: boolean) => {
      setControls((prev) => {
        const layers = normalizeLayerSettings({
          ...prev.layers,
          lowerThirdTemplate: preset.templateId,
          lowerThirdCustomization: preset.customization,
          lowerThirdText: preset.headline,
          lowerThirdSubtext: preset.subline,
          lowerThirdPresetId: preset.id,
          showLowerThird: true,
        });
        persistLayers(layers);
        return {
          ...prev,
          layers,
          pgmLayers: goLive
            ? syncLivePgmGraphics(layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickLowerThirdFields(layers) }))
            : prev.pgmLayers,
        };
      });
    },
    [setControls],
  );

  const toggleLogoLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickLogoFields(prev.layers) }))
          : { ...prev.pgmLayers, showLogo: false },
      }));
    },
    [setControls],
  );

  const toggleCrawlerLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickCrawlerFields(prev.layers) }))
          : { ...prev.pgmLayers, showCrawler: false },
      }));
    },
    [setControls],
  );

  const toggleBreakingLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickBreakingFields(prev.layers) }))
          : { ...prev.pgmLayers, showBreakingNews: false },
      }));
    },
    [setControls],
  );

  const toggleLiveButtonLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(
              prev.layers,
              cloneLayerSettings({ ...prev.pgmLayers, ...pickLiveButtonFields(prev.layers) }),
            )
          : { ...prev.pgmLayers, showLiveButton: false },
      }));
    },
    [setControls],
  );

  const toggleImageLive = useCallback(
    (id: string, live: boolean) => {
      setControls((prev) => {
        const imageOverlays = prev.layers.imageOverlays.map((o) =>
          o.id === id ? { ...o, liveOnPgm: live, visible: live ? true : o.visible } : o,
        );
        const layers = normalizeLayerSettings({ ...prev.layers, imageOverlays });
        persistLayers(layers);
        const pgmLayers = live
          ? syncLivePgmGraphics(
              layers,
              normalizeLayerSettings({
                ...prev.pgmLayers,
                imageOverlays: layers.imageOverlays
                  .filter((o) => o.liveOnPgm)
                  .map((o) => ({ ...o, visible: true })),
              }),
            )
          : normalizeLayerSettings({ ...prev.pgmLayers, imageOverlays: [] });
        return {
          ...prev,
          layers,
          pgmLayers,
        };
      });
    },
    [setControls],
  );

  const removeStackLayer = useCallback(
    (id: LayerStackId) => {
      setControls((prev) => {
        const layers = normalizeLayerSettings(prev.layers);
        const nextOrder = removeStackId(layers.graphicsStackOrder, id);
        let partial: Partial<DashboardControls['layers']> = { graphicsStackOrder: nextOrder };

        if (id.startsWith('image:')) {
          const imgId = id.slice(6);
          partial.imageOverlays = layers.imageOverlays.filter((o) => o.id !== imgId);
        } else if (id === 'breaking') {
          partial = { ...partial, showBreakingNews: false, breakingNews: { ...DEFAULT_BREAKING } };
        } else if (id === 'lower-third') {
          partial = {
            ...partial,
            showLowerThird: false,
            lowerThirdText: '',
            lowerThirdSubtext: '',
            lowerThirdPresetId: null,
          };
        } else if (id === 'logo') {
          partial = { ...partial, showLogo: false, programLogo: { ...DEFAULT_PROGRAM_LOGO } };
        } else if (id === 'crawler') {
          partial = { ...partial, showCrawler: false, crawler: { ...DEFAULT_CRAWLER } };
        } else if (id === 'live-button') {
          partial = { ...partial, showLiveButton: false, liveButton: { ...DEFAULT_LIVE_BUTTON } };
        } else {
          return prev;
        }

        const nextLayers = normalizeLayerSettings({ ...layers, ...partial });
        persistLayers(nextLayers);

        let pgmLayers = normalizeLayerSettings(prev.pgmLayers);
        if (id.startsWith('image:')) {
          const imgId = id.slice(6);
          pgmLayers = normalizeLayerSettings({
            ...pgmLayers,
            imageOverlays: pgmLayers.imageOverlays.filter((o) => o.id !== imgId),
          });
        } else if (id === 'breaking') {
          pgmLayers = { ...pgmLayers, showBreakingNews: false };
        } else if (id === 'lower-third') {
          pgmLayers = { ...pgmLayers, showLowerThird: false };
        } else if (id === 'logo') {
          pgmLayers = { ...pgmLayers, showLogo: false };
        } else if (id === 'crawler') {
          pgmLayers = { ...pgmLayers, showCrawler: false };
        } else if (id === 'live-button') {
          pgmLayers = { ...pgmLayers, showLiveButton: false };
        }

        return { ...prev, layers: nextLayers, pgmLayers };
      });
    },
    [setControls],
  );

  const clearAllPgmGraphics = useCallback(() => {
    setControls((prev) => ({
      ...prev,
      pgmLayers: createClearedPgm(prev.pgmLayers),
    }));
  }, [setControls]);

  const fireTransition = useCallback(
    (type: TransitionGraphicType, title: string, headline: string) => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      setControls((prev) => ({
        ...prev,
        layers: normalizeLayerSettings({
          ...prev.layers,
          transitionGraphic: { ...prev.layers.transitionGraphic, type, title, headline, firing: false },
        }),
        pgmLayers: normalizeLayerSettings({
          ...prev.pgmLayers,
          transitionGraphic: { ...prev.pgmLayers.transitionGraphic, type, title, headline, firing: true },
        }),
      }));
      transitionTimer.current = setTimeout(() => {
        setControls((prev) => ({
          ...prev,
          pgmLayers: normalizeLayerSettings({
            ...prev.pgmLayers,
            transitionGraphic: { ...prev.pgmLayers.transitionGraphic, firing: false },
          }),
        }));
      }, 3200);
    },
    [setControls],
  );

  return {
    patchLayers,
    lowerThirdIsLive,
    toggleLowerThirdLive,
    applyLowerThirdAndLive,
    applySavedPreset,
    toggleLogoLive,
    toggleCrawlerLive,
    toggleBreakingLive,
    toggleLiveButtonLive,
    toggleImageLive,
    clearAllPgmGraphics,
    removeStackLayer,
    fireTransition,
  };
}

function createClearedPgm(pgm: DashboardControls['pgmLayers']): DashboardControls['pgmLayers'] {
  return normalizeLayerSettings({
    ...pgm,
    showLowerThird: false,
    showLogo: false,
    showCrawler: false,
    showBreakingNews: false,
    showLiveButton: false,
    imageOverlays: [],
    transitionGraphic: { ...pgm.transitionGraphic, firing: false },
  });
}
