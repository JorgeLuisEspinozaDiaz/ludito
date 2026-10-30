/**
 * ICE servers for WebRTC across different networks (Vercel viewer ↔ admin).
 * STUN alone often fails behind symmetric NAT — TURN is required in production.
 */

const PUBLIC_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:freeturn.net:3478' },
]

/**
 * Fallback TURN so production works out of the box.
 * Prefer VITE_TURN_* (Metered / coturn) for tráfico real.
 * freeTURN: https://freeturn.net/ (límite ~2 Mbit/s por peer)
 */
const FALLBACK_TURN = [
  {
    urls: [
      'turn:freeturn.net:3478',
      'turn:freeturn.net:3478?transport=tcp',
      'turns:freeturn.net:5349',
      'turns:freeturn.net:5349?transport=tcp',
    ],
    username: 'free',
    credential: 'free',
  },
]

function pushTurnFromEnv(servers) {
  const turnUrl = import.meta.env.VITE_TURN_URL
  const turnUser = import.meta.env.VITE_TURN_USERNAME
  const turnPass = import.meta.env.VITE_TURN_CREDENTIAL
  if (!turnUrl || !turnUser || !turnPass) return false

  const urls = String(turnUrl)
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)

  servers.push({
    urls: urls.length === 1 ? urls[0] : urls,
    username: turnUser,
    credential: turnPass,
  })
  return true
}

export function getIceServers() {
  const servers = [...PUBLIC_STUN]
  const hasCustomTurn = pushTurnFromEnv(servers)
  // Siempre añadimos fallback TURN: en Vercel/Render casi siempre hace falta relay
  if (!hasCustomTurn) servers.push(...FALLBACK_TURN)
  else servers.push(...FALLBACK_TURN)
  return servers
}

export function getRtcConfiguration() {
  return {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  }
}
