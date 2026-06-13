import { createContext, useContext, type ReactNode } from 'react';

type StreamResolver = (deviceId: string) => MediaStream | null;

const AudioStreamResolverContext = createContext<StreamResolver | null>(null);

export function AudioStreamResolverProvider({
  resolveStream,
  children,
}: {
  resolveStream: StreamResolver;
  children: ReactNode;
}) {
  return (
    <AudioStreamResolverContext.Provider value={resolveStream}>
      {children}
    </AudioStreamResolverContext.Provider>
  );
}

export function useAudioStreamResolver(): StreamResolver | null {
  return useContext(AudioStreamResolverContext);
}
