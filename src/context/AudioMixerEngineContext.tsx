import { createContext, useContext, type ReactNode } from 'react';

export type AudioMixerMeterAPI = {
  getChannelAnalyser: (deviceId: string) => AnalyserNode | null;
  getMixBusAnalyser: (bus: 1 | 2 | 3 | 4) => AnalyserNode | null;
  getMasterAnalyser: () => AnalyserNode | null;
  getPgmStream: () => MediaStream | null;
};

const AudioMixerEngineContext = createContext<AudioMixerMeterAPI | null>(null);

export function AudioMixerEngineProvider({
  value,
  children,
}: {
  value: AudioMixerMeterAPI;
  children: ReactNode;
}) {
  return (
    <AudioMixerEngineContext.Provider value={value}>
      {children}
    </AudioMixerEngineContext.Provider>
  );
}

export function useAudioMixerMeters(): AudioMixerMeterAPI | null {
  return useContext(AudioMixerEngineContext);
}
