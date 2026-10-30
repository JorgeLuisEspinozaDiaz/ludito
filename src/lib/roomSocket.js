function wsUrl() {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) {
    // Allow https://host or wss://host or host:port
    if (configured.startsWith('ws://') || configured.startsWith('wss://')) return configured
    if (configured.startsWith('https://')) return configured.replace(/^https/, 'wss')
    if (configured.startsWith('http://')) return configured.replace(/^http/, 'ws')
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${configured.replace(/^\/\//, '')}`
  }

  // Same-origin WebSocket (all-in-one host serving frontend + backend)
  if (import.meta.env.PROD) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.hostname}:3001`
}

export function connectRoom({ room, role, name, code, onEvent }) {
  const url = wsUrl()
  const ws = new WebSocket(url)
  let opened = false

  ws.addEventListener('open', () => {
    opened = true
    ws.send(JSON.stringify({ type: 'join', room, role, name, code }))
  })

  ws.addEventListener('message', (event) => {
    try {
      onEvent?.(JSON.parse(event.data))
    } catch {
      /* ignore */
    }
  })

  ws.addEventListener('close', () => {
    if (opened) onEvent?.({ type: 'disconnected' })
  })

  ws.addEventListener('error', () => {
    onEvent?.({
      type: 'error',
      message: `No se pudo conectar al servidor de salas (${url}). Revisa VITE_WS_URL o que el backend esté activo.`,
    })
  })

  const send = (payload) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  return {
    send,
    close: () => ws.close(),
    raw: ws,
  }
}
