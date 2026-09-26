/** Optimized ICE configuration for free-tier P2P mesh WebRTC. */

const MESH_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
];

function readOptionalTurnServer(): RTCIceServer | null {
  const urls = import.meta.env.VITE_MESH_TURN_URLS?.trim();
  if (!urls) return null;

  const username = import.meta.env.VITE_MESH_TURN_USERNAME?.trim();
  const credential = import.meta.env.VITE_MESH_TURN_CREDENTIAL?.trim();

  const server: RTCIceServer = {
    urls: urls.includes(',') ? urls.split(',').map((u: string) => u.trim()) : urls,
  };
  if (username) server.username = username;
  if (credential) server.credential = credential;
  return server;
}

/** STUN + optional TURN from env for NAT traversal on difficult networks. */
export function buildMeshIceServers(): RTCIceServer[] {
  const turn = readOptionalTurnServer();
  return turn ? [...MESH_STUN_SERVERS, turn] : [...MESH_STUN_SERVERS];
}

export const MESH_ICE_SERVERS: RTCIceServer[] = buildMeshIceServers();

export const MESH_PC_CONFIG: RTCConfiguration = {
  iceServers: MESH_ICE_SERVERS,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10,
};

/** Regal Cloud relay ICE — more stable than free-tier Regal Mesh P2P. */
export const REGAL_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

export const REGAL_WHEP_PC_CONFIG: RTCConfiguration = {
  iceServers: REGAL_ICE_SERVERS,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 4,
};

/** @deprecated Use REGAL_ICE_SERVERS */
export const CLOUDFLARE_ICE_SERVERS = REGAL_ICE_SERVERS;

export function iceServersForMode(mode: 'mesh' | 'regal' | 'cloudflare'): RTCIceServer[] {
  return mode === 'mesh' ? buildMeshIceServers() : REGAL_ICE_SERVERS;
}

export function pcConfigForMode(mode: 'mesh' | 'regal' | 'cloudflare'): RTCConfiguration {
  if (mode === 'mesh') {
    return {
      ...MESH_PC_CONFIG,
      iceServers: buildMeshIceServers(),
    };
  }
  return REGAL_WHEP_PC_CONFIG;
}
