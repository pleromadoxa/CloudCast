/**
 * Legacy mixdown entry points — now delegating to the full export engine
 * (shared FX graph, convolution reverb, automation) in `exportAudio.ts`.
 */
import type { SymphonyProject } from '../../types/symphony';
import { encodeWav, renderProjectToBuffer, type RenderOptions } from './exportAudio';

export { downloadBlob } from './exportAudio';

/** Offline-render project to WAV blob for download. */
export async function renderProjectToWav(project: SymphonyProject): Promise<Blob> {
  const opts: RenderOptions = { sampleRate: 44100, range: 'project', includeTail: true };
  const buffer = await renderProjectToBuffer(project, opts);
  return encodeWav(buffer, 16);
}
