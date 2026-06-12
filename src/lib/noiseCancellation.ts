/** Per-channel noise cancellation DSP tuning. */

export interface NoiseCancelSettings {
  enabled: boolean;
  strength: number;
  autoGate: boolean;
  rumbleCut: boolean;
  voiceFocus: boolean;
}

export const DEFAULT_NOISE_CANCEL: NoiseCancelSettings = {
  enabled: false,
  strength: 68,
  autoGate: true,
  rumbleCut: true,
  voiceFocus: true,
};

export function rumbleHighpassHz(strength: number): number {
  return 55 + (strength / 100) * 165;
}

export function hissLowpassHz(strength: number): number {
  return 14_000 - (strength / 100) * 8_500;
}

export function voicePresenceHz(): number {
  return 2800;
}

export function voicePresenceGainDb(strength: number): number {
  return (strength / 100) * 4.5;
}

/** Gate / expander using DynamicsCompressor as downward expander. */
export function noiseGateParams(
  strength: number,
  learnedFloor: number,
): {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
} {
  const floorBias = (learnedFloor / 100) * 14;
  const threshold = -48 + floorBias - (strength / 100) * 22;
  return {
    threshold,
    ratio: 8 + (strength / 100) * 14,
    attack: 0.004,
    release: 0.08 + (strength / 100) * 0.14,
    knee: 3,
  };
}

export function humNotchFrequency(): number {
  return 60;
}

/** Blend wet NC chain 0–1 from strength when enabled. */
export function ncMixAmount(strength: number): number {
  return 0.45 + (strength / 100) * 0.55;
}
