import { GitBranch, ToggleLeft, ToggleRight } from 'lucide-react';
import { usePrismFeed } from '../../context/PrismFeedContext';
import { NODE_ORDER, type PrismNodeId } from '../../lib/prism/nodeGraph';
import { cn } from '../../lib/utils';

export function PrismNodeEditor() {
  const { studio, togglePipelineNode } = usePrismFeed();

  return (
    <div className="space-y-1">
      <p className="mb-3 flex items-center gap-1.5 text-[10px] text-mixer-muted">
        <GitBranch className="h-3 w-3 text-amber-500" />
        Compositor pipeline — toggle nodes like Aximetry compounds
      </p>
      {NODE_ORDER.map((id, i) => {
        const node = studio.nodeGraph.nodes[id];
        const locked = id === 'camera' || id === 'output';
        return (
          <div key={id}>
            <button
              type="button"
              disabled={locked}
              onClick={() => !locked && togglePipelineNode(id)}
              className={cn(
                'flex w-full items-start gap-2 rounded border px-2 py-2 text-left transition-colors',
                node.enabled
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-white/10 bg-black/30 opacity-60',
                !locked && 'hover:border-amber-500/50',
                locked && 'cursor-default',
              )}
            >
              <span className="mt-0.5 shrink-0 text-amber-500">
                {node.enabled ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-mixer-muted" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-white">{node.label}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-mixer-muted">{node.description}</span>
              </span>
            </button>
            {i < NODE_ORDER.length - 1 && (
              <div className="ml-4 h-3 border-l border-dashed border-amber-500/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { PrismNodeId };
