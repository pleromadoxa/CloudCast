/**
 * Automation scheduling — converts automation lanes into AudioParam ramps.
 * Shared by the real-time engine and the offline mixdown renderer so both
 * perform identical parameter moves.
 */
import type { AutomationLane, AutomationParam, AutomationPoint, Track } from '../../types/symphony';
import { volumeAtBeat } from './automation';

export const SEND_MAX_GAIN = 0.7;

export function laneValueToParam(param: AutomationParam, value: number): number {
  switch (param) {
    case 'volume':
      return Math.max(0, Math.min(1, value / 100));
    case 'pan':
      return Math.max(-1, Math.min(1, value / 100));
    case 'reverbSend':
    case 'delaySend':
      return Math.max(0, Math.min(1, value / 100)) * SEND_MAX_GAIN;
  }
}

/** Legacy volumeAutomation array plus new-style lanes, unified. */
export function trackLanes(track: Track): AutomationLane[] {
  const lanes: AutomationLane[] = [];
  const legacy = track.volumeAutomation;
  if (legacy && legacy.length > 0) {
    lanes.push({ param: 'volume', points: legacy, enabled: true });
  }
  for (const lane of track.automationLanes ?? []) {
    if (!lane.points?.length || lane.enabled === false) continue;
    if (lane.param === 'volume' && lanes.some((l) => l.param === 'volume')) continue;
    lanes.push(lane);
  }
  return lanes;
}

function pointsByBeat(points: AutomationPoint[]): AutomationPoint[] {
  return [...points].sort((a, b) => a.bar * 4 + a.beat - (b.bar * 4 + b.beat));
}

/**
 * Schedule a linear-ramp automation curve onto an AudioParam.
 * `timeAtBeat` maps absolute beat position → AudioContext time.
 */
export function scheduleLaneRamp(
  param: AudioParam,
  lane: AutomationLane,
  fromBeat: number,
  endBeat: number,
  timeAtBeat: (beat: number) => number,
  mapValue: (value: number) => number = (v) => v,
): void {
  const pts = pointsByBeat(lane.points).filter((p) => p.bar * 4 + p.beat <= endBeat);
  if (pts.length === 0) return;

  // Hold the earliest point's value at the window start, then ramp through points.
  const windowStart = timeAtBeat(fromBeat);
  param.setValueAtTime(mapValue(pts[0].value), windowStart);
  let lastTime = windowStart;
  for (const p of pts) {
    const beat = p.bar * 4 + p.beat;
    if (beat < fromBeat) continue;
    const t = Math.max(timeAtBeat(beat), lastTime);
    param.linearRampToValueAtTime(mapValue(p.value), t);
    lastTime = t;
  }
  // Hold final value to the end of the render window.
  const endTime = timeAtBeat(endBeat);
  if (endTime > lastTime) param.setValueAtTime(mapValue(pts[pts.length - 1].value), endTime);
}

/** Static (non-automated) parameter value for a track param. */
export function staticParamValue(track: Track, param: AutomationParam): number {
  switch (param) {
    case 'volume':
      return track.volume;
    case 'pan':
      return track.pan;
    case 'reverbSend':
      return track.reverbSend ?? 0;
    case 'delaySend':
      return track.delaySend ?? 0;
  }
}

/** Volume at a beat including automation (used for note velocity shaping). */
export function trackVolumeAtBeat(track: Track, beat: number): number {
  const lanes = trackLanes(track);
  const vol = lanes.find((l) => l.param === 'volume');
  if (!vol) return track.volume;
  return volumeAtBeat(vol.points, beat, track.volume);
}
