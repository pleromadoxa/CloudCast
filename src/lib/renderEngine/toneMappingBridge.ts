/**
 * Bridge between engine tone-map operators and the `postprocessing` library
 * used by the R3F stages (WebGL2 path). Keeps both backends grading with the
 * same operator family so switching backends never changes the picture's
 * character.
 */
import { ToneMappingMode } from 'postprocessing';
import type { ToneMapOperator } from './types';

export function toneMappingModeFor(op: ToneMapOperator): ToneMappingMode {
  switch (op) {
    case 'agx':
      return ToneMappingMode.AGX;
    case 'aces':
      return ToneMappingMode.ACES_FILMIC;
    case 'neutral':
      return ToneMappingMode.NEUTRAL;
    case 'filmic':
      return ToneMappingMode.CINEON;
    case 'reinhard':
      return ToneMappingMode.REINHARD2;
    case 'linear':
      return ToneMappingMode.LINEAR;
    default:
      return ToneMappingMode.AGX;
  }
}
