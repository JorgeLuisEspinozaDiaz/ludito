function wsUrl() {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) {
    if (configured.startsWith('ws://') || configured.startsWith('wss://')) return configured
    if (configured.startsWith('https://')) return configured.replace(/^https/, 'wss')
    if (configured.startsWith('http://')) return configured.replace(/^http/, 'ws')
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${configured.replace(/^\/\//, '')}`
  }

  if (import.meta.env.PROD) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.hostname}:3001`
}

function httpBaseFromWs(url) {
  return url
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
}

/**
 * Keepalive HTTP para Render Free (evita spin-down ~15min sin tráfico).
 * El video WebRTC NO pasa por Render; solo signaling/sala.
 */
export function startRenderKeepalive(wsUrlString) {
  const base = httpBaseFromWs(wsUrlString).replace(/\/$/, '')
  const ping = () => {
    fetch(`${base}/health`, { method: 'GET', cache: 'no-store', mode: 'cors' }).catch(() => {})
  }
  ping()
  const id = window.setInterval(ping, 4 * 60 * 1000)
  return () => window.clearInterval(id)
}

export function connectRoom({ room, role, name, code, onEvent }) {
  const url = wsUrl()
  let ws = null
  let opened = false
  let closedByUser = false
  let pingTimer = null
  let retryTimer = null
  let retryAttempt = 0
  let stopKeepalive = null

  const clearTimers = () => {
    window.clearInterval(pingTimer)
    window.clearTimeout(retryTimer)
    pingTimer = null
    retryTimer = null
  }

  const attach = () => {
    ws = new WebSocket(url)

    ws.addEventListener('open', () => {
      opened = true
      retryAttempt = 0
      ws.send(JSON.stringify({ type: 'join', room, role, name, code }))
      // App ping: mantiene el proceso despierto en Free
      pingTimer = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 20_000)
      if (!stopKeepalive) stopKeepalive = startRenderKeepalive(url)
    })

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'pong') return
        onEvent?.(data)
      } catch {
        /* ignore */
      }
    })

    ws.addEventListener('close', () => {
      clearTimers()
      if (closedByUser) return
      if (opened) onEvent?.({ type: 'disconnected' })
      // Reconnect con backoff (cold start Render ~30-60s)
      const wait = Math.min(15000, 1200 * (2 ** retryAttempt))
      retryAttempt += 1
      retryTimer = window.setTimeout(attach, wait)
      onEvent?.({
        type: 'error',
        message: retryAttempt === 1
          ? 'Reconectando… si Render estaba dormido puede tardar ~1 min'
          : `Reconectando (intento ${retryAttempt})…`,
      })
    })

    ws.addEventListener('error', () => {
      if (!opened) {
        onEvent?.({
          type: 'error',
          message: `No se pudo conectar al servidor (${url}). Si usas Render Free, espera el wake-up.`,
        })
      }
    })
  }

  attach()

  return {
    send: (payload) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
    },
    close: () => {
      closedByUser = true
      clearTimers()
      stopKeepalive?.()
      stopKeepalive = null
      try { ws?.close() } catch { /* ignore */ }
    },
    raw: () => ws,
    url,
  }
}
