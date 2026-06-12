/** Optimized ICE configuration for free-tier P2P mesh WebRTC. */
export const MESH_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
];

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
  return mode === 'mesh' ? MESH_ICE_SERVERS : REGAL_ICE_SERVERS;
}

export function pcConfigForMode(mode: 'mesh' | 'regal' | 'cloudflare'): RTCConfiguration {
  return mode === 'mesh' ? MESH_PC_CONFIG : REGAL_WHEP_PC_CONFIG;
}
