/** ICE servers for WebRTC (STUN + optional TURN via env) */
export function getIceServers() {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }]

  const turnUrl = import.meta.env.VITE_TURN_URL
  const turnUser = import.meta.env.VITE_TURN_USERNAME
  const turnPass = import.meta.env.VITE_TURN_CREDENTIAL

  if (turnUrl && turnUser && turnPass) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    })
  }

  return servers
}
