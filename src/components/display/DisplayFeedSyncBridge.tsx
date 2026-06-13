import { useDisplayFeedOptional } from '../../context/DisplayFeedContext';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { useDisplayFeedSyncPublisher } from '../../hooks/useDisplayFeedSyncPublisher';
import { createDefaultDisplayFeedState } from '../../types/displayFeed';

/** Keeps congregation / local Display Feed sync alive while Regal Display runs off-route. */
export function DisplayFeedSyncBridge({ enabled }: { enabled: boolean }) {
  const feed = useDisplayFeedOptional();
  const cloudcast = useCloudCastOptional();
  const state = feed?.state ?? createDefaultDisplayFeedState();

  useDisplayFeedSyncPublisher(
    state,
    feed?.liveSlide ?? null,
    cloudcast?.session?.sessionId,
    cloudcast?.session?.realtimeChannel,
    enabled && Boolean(feed) && Boolean(cloudcast?.session?.sessionId),
  );

  return null;
}
