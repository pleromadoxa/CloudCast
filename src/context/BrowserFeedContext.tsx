import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BROWSER_FEED_STORAGE_KEY,
  DEFAULT_BROWSER_FEED_STATE,
  REGAL_BROWSER_DEVICE_ID,
  type BrowserFeedRole,
  type BrowserFeedState,
} from '../types/browserFeed';
import { resolveBrowserUrl, type BrowserUrlKind } from '../lib/browserUrl';
import type { AudioSettings } from '../types/mixer';
import { unlockDashboardAudio } from '../lib/audioOutput';

interface BrowserFeedContextValue {
  state: BrowserFeedState;
  urlKind: BrowserUrlKind;
  pstIsBrowser: boolean;
  pgmIsBrowser: boolean;
  setUrlInput: (value: string) => void;
  navigate: (raw?: string) => { ok: boolean; error?: string };
  reload: () => void;
  clear: () => void;
  setInteractive: (value: boolean) => void;
  setInteractiveOnPgm: (value: boolean) => void;
  setMuted: (value: boolean) => void;
  toggleMuted: () => void;
  /** Which monitor currently owns the live iframe (singleton). */
  iframeOwner: BrowserFeedRole | null;
  claimIframe: (role: BrowserFeedRole) => void;
  releaseIframe: (role: BrowserFeedRole) => void;
  registerYoutubeFrame: (frame: Window | null) => void;
  isProgramMuted: boolean;
  isPreviewMuted: boolean;
  onTogglePreviewMute: () => void;
  onToggleProgramMute: () => void;
  /** Effective mute for iframe/YouTube (program mute when on PGM, else preview). */
  effectiveMuted: boolean;
}

const BrowserFeedContext = createContext<BrowserFeedContextValue | null>(null);

const OWNER_PRIORITY: Record<BrowserFeedRole, number> = {
  pgm: 40,
  pst: 30,
  panel: 20,
  strip: 10,
};

function readStoredState(): BrowserFeedState {
  try {
    const raw = localStorage.getItem(BROWSER_FEED_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BROWSER_FEED_STATE };
    const parsed = JSON.parse(raw) as Partial<BrowserFeedState>;
    return {
      ...DEFAULT_BROWSER_FEED_STATE,
      urlInput: typeof parsed.urlInput === 'string' ? parsed.urlInput : '',
      activeUrl: typeof parsed.activeUrl === 'string' ? parsed.activeUrl : '',
      embedUrl: typeof parsed.embedUrl === 'string' ? parsed.embedUrl : '',
      muted: Boolean(parsed.muted),
      interactive: parsed.interactive !== false,
      interactiveOnPgm: parsed.interactiveOnPgm !== false,
      reloadToken: 0,
    };
  } catch {
    return { ...DEFAULT_BROWSER_FEED_STATE };
  }
}

function postYoutubeCommand(frame: Window | null, func: string, args: unknown[] = []) {
  if (!frame) return;
  try {
    frame.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com',
    );
  } catch {
    /* cross-origin guard */
  }
}

export function BrowserFeedProvider({
  pstDeviceId,
  pgmDeviceId,
  audio,
  onToggleViewAudioMute,
  onToggleInputMute,
  children,
}: {
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  audio: AudioSettings;
  onToggleViewAudioMute: (deviceId: string) => void;
  onToggleInputMute: (deviceId: string) => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<BrowserFeedState>(() => readStoredState());
  const [ownerPretenders, setOwnerPretenders] = useState<Partial<Record<BrowserFeedRole, true>>>({});
  const [ownerClaimOrder, setOwnerClaimOrder] = useState<Partial<Record<BrowserFeedRole, number>>>({});
  const claimSeqRef = useRef(0);
  const youtubeFrameRef = useRef<Window | null>(null);

  const pstIsBrowser = pstDeviceId === REGAL_BROWSER_DEVICE_ID;
  const pgmIsBrowser = pgmDeviceId === REGAL_BROWSER_DEVICE_ID;

  const isPreviewMuted = audio.viewAudioMuted[REGAL_BROWSER_DEVICE_ID] ?? state.muted;
  const isProgramMuted = audio.inputMuted[REGAL_BROWSER_DEVICE_ID] ?? state.muted;
  const effectiveMuted = pgmIsBrowser ? isProgramMuted : isPreviewMuted;

  const resolved = useMemo(
    () => resolveBrowserUrl(state.activeUrl || state.urlInput, { muted: effectiveMuted }),
    [state.activeUrl, state.urlInput, effectiveMuted],
  );

  const urlKind = resolved.kind === 'empty' && state.embedUrl ? 'generic' : resolved.kind;

  useEffect(() => {
    try {
      localStorage.setItem(
        BROWSER_FEED_STORAGE_KEY,
        JSON.stringify({
          urlInput: state.urlInput,
          activeUrl: state.activeUrl,
          embedUrl: state.embedUrl,
          muted: state.muted,
          interactive: state.interactive,
          interactiveOnPgm: state.interactiveOnPgm,
        }),
      );
    } catch {
      /* ignore quota */
    }
  }, [state]);

  // Drive YouTube mute via IFrame API — keep embed URL stable so the page does not reload.
  useEffect(() => {
    if (urlKind !== 'youtube') return;
    postYoutubeCommand(youtubeFrameRef.current, effectiveMuted ? 'mute' : 'unMute');
    if (!effectiveMuted) {
      postYoutubeCommand(youtubeFrameRef.current, 'playVideo');
    }
  }, [effectiveMuted, urlKind, state.reloadToken, state.embedUrl]);

  const iframeOwner = useMemo(() => {
    const roles = (Object.keys(ownerPretenders) as BrowserFeedRole[]).filter(
      (role) => ownerPretenders[role],
    );
    if (roles.length === 0) return null;
    return roles.reduce((best, role) => {
      const bestPri = OWNER_PRIORITY[best];
      const rolePri = OWNER_PRIORITY[role];
      if (rolePri > bestPri) return role;
      if (rolePri < bestPri) return best;
      const bestOrder = ownerClaimOrder[best] ?? 0;
      const roleOrder = ownerClaimOrder[role] ?? 0;
      return roleOrder > bestOrder ? role : best;
    });
  }, [ownerPretenders, ownerClaimOrder]);

  const claimIframe = useCallback((role: BrowserFeedRole) => {
    setOwnerPretenders((prev) => {
      if (prev[role]) return prev;
      claimSeqRef.current += 1;
      const order = claimSeqRef.current;
      setOwnerClaimOrder((prev) => ({ ...prev, [role]: order }));
      return { ...prev, [role]: true };
    });
  }, []);

  const releaseIframe = useCallback((role: BrowserFeedRole) => {
    setOwnerPretenders((prev) => {
      if (!prev[role]) return prev;
      const next = { ...prev };
      delete next[role];
      setOwnerClaimOrder((orders) => {
        const updated = { ...orders };
        delete updated[role];
        return updated;
      });
      return next;
    });
  }, []);

  const registerYoutubeFrame = useCallback((frame: Window | null) => {
    youtubeFrameRef.current = frame;
    if (frame && urlKind === 'youtube') {
      postYoutubeCommand(frame, effectiveMuted ? 'mute' : 'unMute');
    }
  }, [effectiveMuted, urlKind]);

  const setUrlInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, urlInput: value }));
  }, []);

  const navigate = useCallback((raw?: string) => {
    const input = raw ?? state.urlInput;
    const next = resolveBrowserUrl(input, { muted: effectiveMuted });
    if (next.kind === 'empty') {
      return { ok: false, error: 'Enter a URL to open.' };
    }
    if (next.kind === 'invalid') {
      return { ok: false, error: next.error ?? 'Invalid URL.' };
    }
    void unlockDashboardAudio();
    setState((prev) => ({
      ...prev,
      urlInput: input.trim(),
      activeUrl: next.activeUrl,
      embedUrl: next.embedUrl,
      reloadToken: prev.reloadToken + 1,
    }));
    return { ok: true };
  }, [state.urlInput, effectiveMuted]);

  const reload = useCallback(() => {
    if (!state.embedUrl && !state.activeUrl) return;
    setState((prev) => ({ ...prev, reloadToken: prev.reloadToken + 1 }));
  }, [state.embedUrl, state.activeUrl]);

  const clear = useCallback(() => {
    setState((prev) => ({
      ...prev,
      urlInput: '',
      activeUrl: '',
      embedUrl: '',
      reloadToken: prev.reloadToken + 1,
    }));
  }, []);

  const setInteractive = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, interactive: value }));
  }, []);

  const setInteractiveOnPgm = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, interactiveOnPgm: value }));
  }, []);

  const setMuted = useCallback(
    (value: boolean) => {
      setState((prev) => ({ ...prev, muted: value }));
      if (pgmIsBrowser) {
        if (isProgramMuted !== value) onToggleInputMute(REGAL_BROWSER_DEVICE_ID);
      } else if (isPreviewMuted !== value) {
        onToggleViewAudioMute(REGAL_BROWSER_DEVICE_ID);
      }
    },
    [
      pgmIsBrowser,
      isProgramMuted,
      isPreviewMuted,
      onToggleInputMute,
      onToggleViewAudioMute,
    ],
  );

  const toggleMuted = useCallback(() => {
    if (pgmIsBrowser) {
      onToggleInputMute(REGAL_BROWSER_DEVICE_ID);
      setState((prev) => ({ ...prev, muted: !isProgramMuted }));
    } else {
      onToggleViewAudioMute(REGAL_BROWSER_DEVICE_ID);
      setState((prev) => ({ ...prev, muted: !isPreviewMuted }));
    }
  }, [
    pgmIsBrowser,
    isProgramMuted,
    isPreviewMuted,
    onToggleInputMute,
    onToggleViewAudioMute,
  ]);

  const onTogglePreviewMute = useCallback(() => {
    onToggleViewAudioMute(REGAL_BROWSER_DEVICE_ID);
    setState((prev) => ({ ...prev, muted: !isPreviewMuted }));
  }, [onToggleViewAudioMute, isPreviewMuted]);

  const onToggleProgramMute = useCallback(() => {
    onToggleInputMute(REGAL_BROWSER_DEVICE_ID);
    setState((prev) => ({ ...prev, muted: !isProgramMuted }));
  }, [onToggleInputMute, isProgramMuted]);

  const value = useMemo<BrowserFeedContextValue>(
    () => ({
      state: {
        ...state,
        embedUrl: state.embedUrl || resolved.embedUrl,
        activeUrl: state.activeUrl || resolved.activeUrl,
      },
      urlKind: state.embedUrl || resolved.embedUrl ? (resolved.kind === 'empty' ? 'generic' : resolved.kind) : 'empty',
      pstIsBrowser,
      pgmIsBrowser,
      setUrlInput,
      navigate,
      reload,
      clear,
      setInteractive,
      setInteractiveOnPgm,
      setMuted,
      toggleMuted,
      iframeOwner,
      claimIframe,
      releaseIframe,
      registerYoutubeFrame,
      isProgramMuted,
      isPreviewMuted,
      onTogglePreviewMute,
      onToggleProgramMute,
      effectiveMuted,
    }),
    [
      state,
      resolved,
      pstIsBrowser,
      pgmIsBrowser,
      setUrlInput,
      navigate,
      reload,
      clear,
      setInteractive,
      setInteractiveOnPgm,
      setMuted,
      toggleMuted,
      iframeOwner,
      claimIframe,
      releaseIframe,
      registerYoutubeFrame,
      isProgramMuted,
      isPreviewMuted,
      onTogglePreviewMute,
      onToggleProgramMute,
      effectiveMuted,
    ],
  );

  return <BrowserFeedContext.Provider value={value}>{children}</BrowserFeedContext.Provider>;
}

export function useBrowserFeed(): BrowserFeedContextValue {
  const ctx = useContext(BrowserFeedContext);
  if (!ctx) throw new Error('useBrowserFeed must be used within BrowserFeedProvider');
  return ctx;
}

export function useBrowserFeedOptional(): BrowserFeedContextValue | null {
  return useContext(BrowserFeedContext);
}
