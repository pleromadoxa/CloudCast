import { describe, expect, it } from 'vitest';
import { amplitudeToMeter, MeterBallistics } from './metering';
import {
  laneValueToParam, staticParamValue, trackLanes, trackVolumeAtBeat,
} from './automationSchedule';
import { makeDriveCurve, makeSoftClipCurve } from './fxChain';
import type { Track } from '../../types/symphony';

describe('amplitudeToMeter', () => {
  it('maps silence to zero and full scale to 100', () => {
    expect(amplitudeToMeter(0)).toBe(0);
    expect(amplitudeToMeter(1)).toBe(100);
    expect(amplitudeToMeter(0.5)).toBeCloseTo(90, 0); // −6 dB sits 90% up a −60 dB scale
    expect(amplitudeToMeter(2)).toBe(100); // clamped
  });
});

describe('MeterBallistics', () => {
  it('attacks instantly and decays gradually', () => {
    const m = new MeterBallistics(1000, 24);
    const t0 = 1000;
    const first = m.push({ a: 80 }, t0);
    expect(first.a.level).toBe(80);

    const second = m.push({ a: 10 }, t0 + 60);
    expect(second.a.level).toBeLessThan(80);
    expect(second.a.level).toBeGreaterThan(10); // decayed, not jumped
  });

  it('holds the peak marker until hold time expires', () => {
    const m = new MeterBallistics(500, 24);
    const t0 = 2000;
    let r = m.push({ a: 90 }, t0);
    expect(r.a.peak).toBe(90);
    r = m.push({ a: 20 }, t0 + 100);
    expect(r.a.peak).toBe(90); // still holding
    r = m.push({ a: 20 }, t0 + 700);
    expect(r.a.peak).toBeLessThan(90); // released after hold time
  });

  it('resets cleanly', () => {
    const m = new MeterBallistics(1000, 24);
    m.push({ a: 90 }, 1000);
    m.reset();
    const r = m.push({ a: 5 }, 1100);
    expect(r.a.level).toBe(5);
    expect(r.a.peak).toBe(5);
  });
});

describe('automation helpers', () => {
  it('converts lane values to audio params', () => {
    expect(laneValueToParam('volume', 50)).toBeCloseTo(0.5);
    expect(laneValueToParam('volume', 150)).toBe(1);
    expect(laneValueToParam('pan', -50)).toBeCloseTo(-0.5);
    expect(laneValueToParam('reverbSend', 100)).toBeCloseTo(0.7);
    expect(laneValueToParam('delaySend', 0)).toBe(0);
  });

  it('merges legacy volumeAutomation with new lanes', () => {
    const track = {
      volume: 80, pan: 0, reverbSend: 10, delaySend: 5,
      volumeAutomation: [{ bar: 0, beat: 0, value: 40 }],
      automationLanes: [
        { param: 'pan', points: [{ bar: 1, beat: 0, value: 20 }] },
        { param: 'volume', points: [{ bar: 2, beat: 0, value: 90 }] }, // duplicate → dropped
        { param: 'delaySend', points: [], enabled: true }, // empty → dropped
      ],
    } as unknown as Track;

    const lanes = trackLanes(track);
    expect(lanes).toHaveLength(2);
    expect(lanes[0].param).toBe('volume');
    expect(lanes[1].param).toBe('pan');
  });

  it('skips disabled lanes and reads volume through automation', () => {
    const track = {
      volume: 80, pan: 0, reverbSend: 0, delaySend: 0,
      automationLanes: [
        { param: 'volume', enabled: false, points: [{ bar: 0, beat: 0, value: 10 }] },
        { param: 'volume', enabled: true, points: [{ bar: 0, beat: 0, value: 100 }, { bar: 1, beat: 0, value: 20 }] },
      ],
    } as unknown as Track;

    const lanes = trackLanes(track);
    expect(lanes).toHaveLength(1);
    expect(trackVolumeAtBeat(track, 0)).toBe(100);
    expect(trackVolumeAtBeat(track, 2)).toBe(60); // halfway between 100 and 20
    expect(trackVolumeAtBeat(track, 8)).toBe(20);
  });

  it('reads static values without automation', () => {
    const track = { volume: 70, pan: -25, reverbSend: 30, delaySend: 15 } as Track;
    expect(staticParamValue(track, 'volume')).toBe(70);
    expect(staticParamValue(track, 'pan')).toBe(-25);
    expect(staticParamValue(track, 'reverbSend')).toBe(30);
    expect(staticParamValue(track, 'delaySend')).toBe(15);
    expect(trackVolumeAtBeat(track, 4)).toBe(70);
  });
});

describe('fx curves', () => {
  it('drive curve is symmetric and centered on zero', () => {
    const curve = makeDriveCurve(50);
    expect(curve.length).toBe(1024);
    expect(curve[512]).toBeCloseTo(0, 2);
    expect(curve[1023]).toBeGreaterThan(0);
    expect(curve[0]).toBeLessThan(0);
  });

  it('soft clip maps full scale near unity', () => {
    const curve = makeSoftClipCurve();
    expect(curve[0]).toBeCloseTo(-1, 2);
    expect(curve[1023]).toBeCloseTo(1, 2);
    expect(curve[512]).toBeCloseTo(0, 2);
  });
});
