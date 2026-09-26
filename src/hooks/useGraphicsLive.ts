import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { DashboardControls } from '../types/controls';
import type { LayerStackId } from '../types/graphicsStack';
import type { LowerThirdTemplateId, MediaLibraryItem, OverlayPosition, SavedLowerThirdPreset, TransitionGraphicType } from '../types/overlays';
import {
  DEFAULT_AD_ZONE,
  DEFAULT_BREAKING,
  DEFAULT_COUNTDOWN,
  DEFAULT_CRAWLER,
  DEFAULT_LIVE_BUTTON,
  DEFAULT_PROGRAM_LOGO,
  DEFAULT_SCOREBOARD,
  DEFAULT_SPONSOR_BUG,
  DEFAULT_WEATHER,
  resolveMediaPlayUrl,
} from '../types/overlays';
import { inferImageOverlayDefaults } from '../lib/mediaImagePlacement';
import { removeStackId } from '../lib/graphicsStackOrder';
import { getLowerThirdSampleText, resolveLowerThirdCustomization } from '../lib/lowerThirdTemplates';
import {
  cloneLayerSettings,
  hasLivePgmGraphics,
  normalizeLayerSettings,
  pickAdZoneFields,
  pickBreakingFields,
  pickCountdownFields,
  pickCrawlerFields,
  pickLiveButtonFields,
  pickLowerThirdFields,
  pickLogoFields,
  pickScoreboardFields,
  pickSponsorBugFields,
  pickWeatherFields,
  syncLivePgmGraphics,
} from '../lib/layerSettings';
import { saveOverlayLayers } from '../lib/overlayStorage';

type SetControls = Dispatch<SetStateAction<DashboardControls>>;

function persistLayers(layers: DashboardControls['layers']) {
  saveOverlayLayers({
    imageOverlays: layers.imageOverlays,
    videoOverlays: layers.videoOverlays,
    mediaLibrary: layers.mediaLibrary,
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
    weather: layers.weather,
    showWeather: layers.showWeather,
    adZone: layers.adZone,
    showAdZone: layers.showAdZone,
    scoreboard: layers.scoreboard,
    showScoreboard: layers.showScoreboard,
    countdown: layers.countdown,
    showCountdown: layers.showCountdown,
    sponsorBug: layers.sponsorBug,
    showSponsorBug: layers.showSponsorBug,
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
      setControls((prev) => {
        if (!live) {
          return {
            ...prev,
            pgmLayers: normalizeLayerSettings({ ...prev.pgmLayers, showLowerThird: false }),
          };
        }

        let layers = prev.layers;
        if (!layers.lowerThirdText.trim()) {
          const sample = getLowerThirdSampleText(layers.lowerThirdTemplate);
          layers = normalizeLayerSettings({
            ...layers,
            showLowerThird: true,
            lowerThirdText: sample.title,
            lowerThirdSubtext: layers.lowerThirdSubtext.trim() ? layers.lowerThirdSubtext : sample.sub,
          });
          persistLayers(layers);
        }

        return {
          ...prev,
          layers,
          pgmLayers: syncLivePgmGraphics(
            layers,
            cloneLayerSettings({ ...prev.pgmLayers, ...pickLowerThirdFields(layers) }),
          ),
        };
      });
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

  const toggleWeatherLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickWeatherFields(prev.layers) }))
          : { ...prev.pgmLayers, showWeather: false },
      }));
    },
    [setControls],
  );

  const toggleAdZoneLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickAdZoneFields(prev.layers) }))
          : { ...prev.pgmLayers, showAdZone: false },
      }));
    },
    [setControls],
  );

  const toggleScoreboardLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickScoreboardFields(prev.layers) }))
          : { ...prev.pgmLayers, showScoreboard: false },
      }));
    },
    [setControls],
  );

  const toggleCountdownLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickCountdownFields(prev.layers) }))
          : { ...prev.pgmLayers, showCountdown: false },
      }));
    },
    [setControls],
  );

  const toggleSponsorBugLive = useCallback(
    (live: boolean) => {
      setControls((prev) => ({
        ...prev,
        pgmLayers: live
          ? syncLivePgmGraphics(prev.layers, cloneLayerSettings({ ...prev.pgmLayers, ...pickSponsorBugFields(prev.layers) }))
          : { ...prev.pgmLayers, showSponsorBug: false },
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
          : normalizeLayerSettings({
              ...prev.pgmLayers,
              imageOverlays: prev.pgmLayers.imageOverlays.filter((o) => o.id !== id),
            });
        return {
          ...prev,
          layers,
          pgmLayers,
        };
      });
    },
    [setControls],
  );

  const toggleVideoLive = useCallback(
    (id: string, live: boolean) => {
      setControls((prev) => {
        const videoOverlays = prev.layers.videoOverlays.map((o) =>
          o.id === id ? { ...o, liveOnPgm: live, visible: live ? true : o.visible } : o,
        );
        const layers = normalizeLayerSettings({ ...prev.layers, videoOverlays });
        persistLayers(layers);
        const pgmLayers = live
          ? syncLivePgmGraphics(
              layers,
              normalizeLayerSettings({
                ...prev.pgmLayers,
                videoOverlays: layers.videoOverlays
                  .filter((o) => o.liveOnPgm)
                  .map((o) => ({ ...o, visible: true })),
              }),
            )
          : normalizeLayerSettings({
              ...prev.pgmLayers,
              videoOverlays: prev.pgmLayers.videoOverlays.filter((o) => o.id !== id),
            });
        return {
          ...prev,
          layers,
          pgmLayers,
        };
      });
    },
    [setControls],
  );

  const takeMediaLive = useCallback(
    (id: string, kind: 'image' | 'video') => {
      setControls((prev) => {
        const alreadyLive =
          kind === 'image'
            ? prev.pgmLayers.imageOverlays.some((o) => o.id === id && o.liveOnPgm)
            : prev.pgmLayers.videoOverlays.some((o) => o.id === id && o.liveOnPgm);

        if (alreadyLive) {
          const layers = normalizeLayerSettings({
            ...prev.layers,
            imageOverlays: prev.layers.imageOverlays.map((o) => ({ ...o, liveOnPgm: false })),
            videoOverlays: prev.layers.videoOverlays.map((o) => ({ ...o, liveOnPgm: false })),
          });
          persistLayers(layers);
          return {
            ...prev,
            layers,
            pgmLayers: normalizeLayerSettings({
              ...prev.pgmLayers,
              imageOverlays: [],
              videoOverlays: [],
            }),
          };
        }

        const imageOverlays = prev.layers.imageOverlays.map((o) => ({
          ...o,
          liveOnPgm: kind === 'image' && o.id === id,
          visible: kind === 'image' && o.id === id ? true : o.visible,
        }));
        const videoOverlays = prev.layers.videoOverlays.map((o) => ({
          ...o,
          liveOnPgm: kind === 'video' && o.id === id,
          visible: kind === 'video' && o.id === id ? true : o.visible,
        }));

        const layers = normalizeLayerSettings({ ...prev.layers, imageOverlays, videoOverlays });
        persistLayers(layers);

        const liveImage =
          kind === 'image' ? layers.imageOverlays.find((o) => o.id === id) ?? null : null;
        const liveVideo =
          kind === 'video' ? layers.videoOverlays.find((o) => o.id === id) ?? null : null;

        const pgmLayers = normalizeLayerSettings({
          ...prev.pgmLayers,
          imageOverlays: liveImage ? [{ ...liveImage, visible: true, liveOnPgm: true }] : [],
          videoOverlays: liveVideo ? [{ ...liveVideo, visible: true, liveOnPgm: true }] : [],
        });

        return { ...prev, layers, pgmLayers };
      });
    },
    [setControls],
  );

  const stageMediaPreview = useCallback(
    (item: MediaLibraryItem) => {
      setControls((prev) => {
        const playUrl = resolveMediaPlayUrl(item);
        const stackId = (item.kind === 'video' ? `video:${item.id}` : `image:${item.id}`) as LayerStackId;

        const nextOrder = [...prev.layers.graphicsStackOrder];
        if (!nextOrder.includes(stackId)) {
          const logoIdx = nextOrder.indexOf('logo');
          if (logoIdx >= 0) nextOrder.splice(logoIdx, 0, stackId);
          else nextOrder.push(stackId);
        }

        let imageOverlays = [...prev.layers.imageOverlays];
        let videoOverlays = [...prev.layers.videoOverlays];

        if (item.kind === 'image') {
          const existing = imageOverlays.find((o) => o.id === item.id);
          const placement = inferImageOverlayDefaults(item.naturalWidth, item.naturalHeight);
          const overlay = existing
            ? { ...existing, dataUrl: playUrl, visible: true, liveOnPgm: false }
            : {
                id: item.id,
                name: item.name,
                dataUrl: playUrl,
                naturalWidth: item.naturalWidth,
                naturalHeight: item.naturalHeight,
                ...placement,
                opacity: 100,
                visible: true,
                liveOnPgm: false,
              };
          imageOverlays = [
            ...imageOverlays.filter((o) => o.id !== item.id),
            overlay,
          ];
        } else {
          const existing = videoOverlays.find((o) => o.id === item.id);
          const overlay = existing
            ? { ...existing, dataUrl: playUrl, visible: true, liveOnPgm: false }
            : {
                id: item.id,
                name: item.name,
                dataUrl: playUrl,
                naturalWidth: item.naturalWidth,
                naturalHeight: item.naturalHeight,
                scale: 100,
                opacity: 100,
                position: 'center' as OverlayPosition,
                visible: true,
                liveOnPgm: false,
                fillScreen: true,
                loop: true,
                muted: false,
              };
          videoOverlays = [
            ...videoOverlays.filter((o) => o.id !== item.id),
            overlay,
          ];
        }

        const layers = normalizeLayerSettings({
          ...prev.layers,
          imageOverlays,
          videoOverlays,
          graphicsStackOrder: nextOrder,
        });
        persistLayers(layers);
        return { ...prev, layers };
      });
    },
    [setControls],
  );

  const stageAndTakeMediaLive = useCallback(
    (item: MediaLibraryItem) => {
      setControls((prev) => {
        const playUrl = resolveMediaPlayUrl(item);
        const stackId = (item.kind === 'video' ? `video:${item.id}` : `image:${item.id}`) as LayerStackId;
        const alreadyLive =
          item.kind === 'image'
            ? prev.pgmLayers.imageOverlays.some((o) => o.id === item.id && o.liveOnPgm)
            : prev.pgmLayers.videoOverlays.some((o) => o.id === item.id && o.liveOnPgm);

        if (alreadyLive) {
          const layers = normalizeLayerSettings({
            ...prev.layers,
            imageOverlays: prev.layers.imageOverlays.map((o) => ({ ...o, liveOnPgm: false })),
            videoOverlays: prev.layers.videoOverlays.map((o) => ({ ...o, liveOnPgm: false })),
          });
          persistLayers(layers);
          return {
            ...prev,
            layers,
            pgmLayers: normalizeLayerSettings({
              ...prev.pgmLayers,
              imageOverlays: [],
              videoOverlays: [],
            }),
          };
        }

        const nextOrder = [...prev.layers.graphicsStackOrder];
        if (!nextOrder.includes(stackId)) {
          const logoIdx = nextOrder.indexOf('logo');
          if (logoIdx >= 0) nextOrder.splice(logoIdx, 0, stackId);
          else nextOrder.push(stackId);
        }

        let imageOverlays = [...prev.layers.imageOverlays];
        let videoOverlays = [...prev.layers.videoOverlays];

        if (item.kind === 'image') {
          const existing = imageOverlays.find((o) => o.id === item.id);
          const placement = inferImageOverlayDefaults(item.naturalWidth, item.naturalHeight);
          const overlay = existing
            ? { ...existing, dataUrl: playUrl, visible: true, liveOnPgm: true }
            : {
                id: item.id,
                name: item.name,
                dataUrl: playUrl,
                naturalWidth: item.naturalWidth,
                naturalHeight: item.naturalHeight,
                ...placement,
                opacity: 100,
                visible: true,
                liveOnPgm: true,
              };
          imageOverlays = [
            ...imageOverlays.filter((o) => o.id !== item.id).map((o) => ({ ...o, liveOnPgm: false })),
            overlay,
          ];
          videoOverlays = videoOverlays.map((o) => ({ ...o, liveOnPgm: false }));
        } else {
          const existing = videoOverlays.find((o) => o.id === item.id);
          const overlay = existing
            ? { ...existing, dataUrl: playUrl, visible: true, liveOnPgm: true }
            : {
                id: item.id,
                name: item.name,
                dataUrl: playUrl,
                naturalWidth: item.naturalWidth,
                naturalHeight: item.naturalHeight,
                scale: 100,
                opacity: 100,
                position: 'center' as OverlayPosition,
                visible: true,
                liveOnPgm: true,
                fillScreen: true,
                loop: true,
                muted: false,
              };
          videoOverlays = [
            ...videoOverlays.filter((o) => o.id !== item.id).map((o) => ({ ...o, liveOnPgm: false })),
            overlay,
          ];
          imageOverlays = imageOverlays.map((o) => ({ ...o, liveOnPgm: false }));
        }

        const layers = normalizeLayerSettings({
          ...prev.layers,
          imageOverlays,
          videoOverlays,
          graphicsStackOrder: nextOrder,
        });
        persistLayers(layers);

        const liveImage = item.kind === 'image' ? layers.imageOverlays.find((o) => o.id === item.id) : null;
        const liveVideo = item.kind === 'video' ? layers.videoOverlays.find((o) => o.id === item.id) : null;

        const pgmLayers = normalizeLayerSettings({
          ...prev.pgmLayers,
          imageOverlays: liveImage ? [{ ...liveImage, visible: true, liveOnPgm: true }] : [],
          videoOverlays: liveVideo ? [{ ...liveVideo, visible: true, liveOnPgm: true }] : [],
        });

        return { ...prev, layers, pgmLayers };
      });
    },
    [setControls],
  );

  const patchPgmLayers = useCallback(
    (partial: Partial<DashboardControls['pgmLayers']>) => {
      setControls((prev) => {
        const pgmLayers = normalizeLayerSettings({ ...prev.pgmLayers, ...partial });
        let layers = prev.layers;

        if (partial.imageOverlays) {
          const patchMap = new Map(partial.imageOverlays.map((o) => [o.id, o]));
          layers = normalizeLayerSettings({
            ...layers,
            imageOverlays: layers.imageOverlays.map((o) => {
              const patch = patchMap.get(o.id);
              return patch ? { ...o, ...patch } : o;
            }),
          });
        }
        if (partial.videoOverlays) {
          const patchMap = new Map(partial.videoOverlays.map((o) => [o.id, o]));
          layers = normalizeLayerSettings({
            ...layers,
            videoOverlays: layers.videoOverlays.map((o) => {
              const patch = patchMap.get(o.id);
              return patch ? { ...o, ...patch } : o;
            }),
          });
        }

        persistLayers(layers);
        return { ...prev, layers, pgmLayers };
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
        } else if (id.startsWith('video:')) {
          const vidId = id.slice(6);
          partial.videoOverlays = layers.videoOverlays.filter((o) => o.id !== vidId);
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
        } else if (id === 'weather') {
          partial = { ...partial, showWeather: false, weather: { ...DEFAULT_WEATHER } };
        } else if (id === 'ad-zone') {
          partial = { ...partial, showAdZone: false, adZone: { ...DEFAULT_AD_ZONE } };
        } else if (id === 'scoreboard') {
          partial = { ...partial, showScoreboard: false, scoreboard: { ...DEFAULT_SCOREBOARD } };
        } else if (id === 'countdown') {
          partial = { ...partial, showCountdown: false, countdown: { ...DEFAULT_COUNTDOWN } };
        } else if (id === 'sponsor-bug') {
          partial = { ...partial, showSponsorBug: false, sponsorBug: { ...DEFAULT_SPONSOR_BUG } };
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
        } else if (id.startsWith('video:')) {
          const vidId = id.slice(6);
          pgmLayers = normalizeLayerSettings({
            ...pgmLayers,
            videoOverlays: pgmLayers.videoOverlays.filter((o) => o.id !== vidId),
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
        } else if (id === 'weather') {
          pgmLayers = { ...pgmLayers, showWeather: false };
        } else if (id === 'ad-zone') {
          pgmLayers = { ...pgmLayers, showAdZone: false };
        } else if (id === 'scoreboard') {
          pgmLayers = { ...pgmLayers, showScoreboard: false };
        } else if (id === 'countdown') {
          pgmLayers = { ...pgmLayers, showCountdown: false };
        } else if (id === 'sponsor-bug') {
          pgmLayers = { ...pgmLayers, showSponsorBug: false };
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
    toggleWeatherLive,
    toggleAdZoneLive,
    toggleScoreboardLive,
    toggleCountdownLive,
    toggleSponsorBugLive,
    toggleImageLive,
    toggleVideoLive,
    takeMediaLive,
    stageMediaPreview,
    stageAndTakeMediaLive,
    patchPgmLayers,
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
    showWeather: false,
    showAdZone: false,
    showScoreboard: false,
    showCountdown: false,
    showSponsorBug: false,
    imageOverlays: [],
    videoOverlays: [],
    transitionGraphic: { ...pgm.transitionGraphic, firing: false },
  });
}
