/** Aximetry-style compositor pipeline node definitions. */

export type PrismNodeId = 'camera' | 'keyer' | 'virtual_set' | 'pip' | 'graphics' | 'output';

export interface PrismPipelineNode {
  id: PrismNodeId;
  label: string;
  description: string;
  enabled: boolean;
}

export interface PrismNodeGraph {
  nodes: Record<PrismNodeId, PrismPipelineNode>;
}

export const DEFAULT_NODE_GRAPH: PrismNodeGraph = {
  nodes: {
    camera: {
      id: 'camera',
      label: 'Camera Input',
      description: 'Live webcam, USB capture, or CloudCast Mobile feed',
      enabled: true,
    },
    keyer: {
      id: 'keyer',
      label: 'Chroma Keyer',
      description: 'Real-time GPU key with spill suppression & light wrap',
      enabled: true,
    },
    virtual_set: {
      id: 'virtual_set',
      label: 'Virtual Set',
      description: '3D environment, talent plane, shadows & reflections',
      enabled: true,
    },
    pip: {
      id: 'pip',
      label: 'Multi-Cam PiP',
      description: 'Picture-in-picture secondary camera angles',
      enabled: false,
    },
    graphics: {
      id: 'graphics',
      label: 'Broadcast Graphics',
      description: 'Lower thirds and on-screen text overlays',
      enabled: true,
    },
    output: {
      id: 'output',
      label: 'Program Output',
      description: 'Mixer feed, RTMP stream, and recording',
      enabled: true,
    },
  },
};

export const NODE_ORDER: PrismNodeId[] = [
  'camera',
  'keyer',
  'virtual_set',
  'pip',
  'graphics',
  'output',
];

export function toggleNode(graph: PrismNodeGraph, id: PrismNodeId): PrismNodeGraph {
  const node = graph.nodes[id];
  if (id === 'camera' || id === 'output') return graph;
  return {
    nodes: {
      ...graph.nodes,
      [id]: { ...node, enabled: !node.enabled },
    },
  };
}

export function setNodeEnabled(graph: PrismNodeGraph, id: PrismNodeId, enabled: boolean): PrismNodeGraph {
  const node = graph.nodes[id];
  if (node.enabled === enabled) return graph;
  return {
    nodes: {
      ...graph.nodes,
      [id]: { ...node, enabled },
    },
  };
}
