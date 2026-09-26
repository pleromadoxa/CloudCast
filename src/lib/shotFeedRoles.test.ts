import { describe, expect, it } from 'vitest';
import { shotFeedRolesForDevice, shotFeedRolesForTile } from './shotFeedRoles';

describe('shotFeedRoles', () => {
  it('assigns pgm roles for program bus device', () => {
    expect(
      shotFeedRolesForTile('regal-media-feed', 'cam-1', 'regal-media-feed'),
    ).toEqual({ mediaFeedRole: 'pgm', browserFeedRole: 'pgm' });
  });

  it('assigns pst roles for preview bus device', () => {
    expect(
      shotFeedRolesForTile('regal-browser-feed', 'regal-browser-feed', 'cam-1'),
    ).toEqual({ mediaFeedRole: 'pst', browserFeedRole: 'pst' });
  });

  it('uses strip roles for encode clone surfaces without a monitor label', () => {
    expect(
      shotFeedRolesForTile('regal-browser-feed', 'regal-browser-feed', 'regal-browser-feed', {
        captureClone: true,
      }),
    ).toEqual({ mediaFeedRole: 'strip', browserFeedRole: 'strip' });
  });

  it('uses program media on the PGM encode clone without stealing the browser iframe', () => {
    expect(
      shotFeedRolesForTile('regal-media-feed', 'cam-1', 'regal-media-feed', {
        captureClone: true,
        monitorLabel: 'PGM',
      }),
    ).toEqual({ mediaFeedRole: 'pgm', browserFeedRole: 'strip' });
  });

  it('defaults strip for unrelated tiles', () => {
    expect(shotFeedRolesForDevice('cam-2', 'cam-1', 'cam-3')).toEqual({
      mediaFeedRole: 'strip',
      browserFeedRole: 'strip',
    });
  });
});
