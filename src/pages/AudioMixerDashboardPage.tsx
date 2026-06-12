import { CloudCastProvider } from '../context/CloudCastContext';
import { PgmAudioProvider } from '../context/PgmAudioContext';
import { MixerErrorBoundary } from '../components/error/MixerErrorBoundary';
import { AudioMixerLayout } from '../components/audio/AudioMixerLayout';

export function AudioMixerDashboardPage() {
  return (
    <MixerErrorBoundary>
      <CloudCastProvider productType="audio">
        <PgmAudioProvider localPlayback={false}>
          <AudioMixerLayout />
        </PgmAudioProvider>
      </CloudCastProvider>
    </MixerErrorBoundary>
  );
}
