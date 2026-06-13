import { useEffect, useState } from 'react';
import { Loader2, Radio, Square } from 'lucide-react';
import { fetchStreamDestinations } from '../../lib/streamingService';
import { usePrismBroadcast } from '../../hooks/usePrismBroadcast';
import { usePrismFeed } from '../../context/PrismFeedContext';
import type { StreamDestination } from '../../types/streaming';
import { cn } from '../../lib/utils';

interface PrismStreamPanelProps {
  canStream: boolean;
  buildProgramStream: (stream: MediaStream | null) => MediaStream | null;
  hasAudio: boolean;
}

export function PrismStreamPanel({ canStream, buildProgramStream, hasAudio }: PrismStreamPanelProps) {
  const { programStream, isLive, goLive } = usePrismFeed();
  const broadcast = usePrismBroadcast();
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchStreamDestinations()
      .then(setDestinations)
      .catch(() => setDestinations([]))
      .finally(() => setLoading(false));
  }, []);

  const enabled = destinations.filter((d) => d.isEnabled);

  const handleStream = async () => {
    if (broadcast.isBroadcasting) {
      await broadcast.stopBroadcast();
      setNotice('Stream stopped.');
      return;
    }
    if (!programStream && !isLive) {
      goLive();
    }
    const stream = buildProgramStream(programStream);
    if (!stream) {
      setNotice('Start camera and route to mixer first, or wait for composite.');
      return;
    }
    const result = await broadcast.startBroadcast(enabled, stream);
    setNotice(
      result.ok && hasAudio
        ? `${result.message} Audio included.`
        : result.ok && !hasAudio
          ? `${result.message} Video only — enable Program Audio below.`
          : result.message,
    );
  };

  if (!canStream) {
    return (
      <p className="text-xs text-mixer-muted">
        RTMP streaming unlocks on Pro. Upgrade to stream your virtual production composite directly to YouTube, Twitch, or custom RTMP.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
      ) : enabled.length === 0 ? (
        <p className="text-[10px] text-mixer-muted">
          No enabled destinations. Add RTMP outputs in Video Mixer → Stream panel or Profile.
        </p>
      ) : (
        <ul className="space-y-1 text-[10px] text-mixer-muted">
          {enabled.map((d) => (
            <li key={d.id} className="truncate">• {d.name} ({d.platform})</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={enabled.length === 0 || broadcast.status === 'connecting'}
        onClick={() => void handleStream()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-bold tracking-wider',
          broadcast.isBroadcasting
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-amber-500 text-black hover:bg-amber-400',
          (enabled.length === 0 || broadcast.status === 'connecting') && 'opacity-40',
        )}
      >
        {broadcast.status === 'connecting' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : broadcast.isBroadcasting ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Radio className="h-3.5 w-3.5" />
        )}
        {broadcast.isBroadcasting ? 'STOP RTMP' : 'GO LIVE · RTMP'}
      </button>
      {notice && <p className="text-[10px] text-emerald-400">{notice}</p>}
      {broadcast.error && <p className="text-[10px] text-mixer-red">{broadcast.error}</p>}
    </div>
  );
}
