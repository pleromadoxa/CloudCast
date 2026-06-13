import { useProgramPresetsOptional } from '../../context/ProgramPresetContext';
import { ProgramPresetSelector } from './ProgramPresetSelector';

/** Blocks production dashboards until the user selects or creates a program preset. */
export function ProgramPresetGate() {
  const presets = useProgramPresetsOptional();
  if (!presets?.needsSelection) return null;
  return <ProgramPresetSelector variant="gate" />;
}
