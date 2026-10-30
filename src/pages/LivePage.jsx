import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { JoinGate } from '../components/JoinGate'
import { RoomArena } from '../components/RoomArena'
import { useRoom } from '../hooks/useRoom'
import { DEMO_ACCESS_CODE, DEFAULT_ROOM } from '../lib/constants'
import { createViewer } from '../lib/webrtcBroadcast'

export function LivePage() {
  const { roomId = DEFAULT_ROOM, pin: pinParam } = useParams()
  const [searchParams] = useSearchParams()
  const roomKey = roomId.toUpperCase()
  const linkPin = String(pinParam || searchParams.get('pin') || '').trim()

  const [credentials, setCredentials] = useState(() => (
    linkPin ? { name: 'jugador', code: linkPin } : null
  ))
  const [media, setMedia] = useState({
    screen: null,
    camera: null,
    playback: null,
    combined: null,
    hasVideo: false,
    hasAudio: false,
    connectionState: 'new',
    iceState: 'new',
  })
  const [resultBanner, setResultBanner] = useState(null)
  const [toasts, setToasts] = useState([])
  const viewerRef = useRef(null)
  const youRef = useRef(null)
  const stateRef = useRef(null)
  const sendRef = useRef(null)
  const retryTimerRef = useRef(null)
  const lastRequestRef = useRef(0)

  const { state, you, error, connected, send, setHandlers, setError } = useRoom({
    roomId: roomKey,
    role: 'viewer',
    enabled: Boolean(credentials),
    credentials,
  })

  // Espectador: NUNCA pedir micrófono/cámara del dispositivo
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.getUserMedia) return undefined
    const original = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      const blocked = Boolean(constraints?.audio || constraints?.video)
      if (blocked) {
        return Promise.reject(new DOMException('Los espectadores no usan micrófono ni cámara', 'NotAllowedError'))
      }
      return original(constraints)
    }
    return () => {
      media.getUserMedia = original
    }
  }, [])

  useEffect(() => {
    if (linkPin) {
      setCredentials({ name: 'jugador', code: linkPin })
      setError('')
    }
  }, [linkPin, setError])

  useEffect(() => {
    youRef.current = you
  }, [you])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushToast = useCallback((order) => {
    setToasts((current) => [...current, order].slice(-5))
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== order.id))
    }, 4200)
  }, [])

  useEffect(() => {
    sendRef.current = send
  }, [send])

  const requestStream = useCallback((reason = 'manual') => {
    const now = Date.now()
    // Evita spam que rompe la negociación WebRTC del admin
    if (reason !== 'force' && now - lastRequestRef.current < 2500) return
    lastRequestRef.current = now
    sendRef.current?.({ type: 'request_stream' })
  }, [])

  useEffect(() => {
    viewerRef.current = createViewer({
      sendSignal: (to, signal) => sendRef.current?.({ type: 'signal', to, signal }),
      onStreams: (next) => setMedia(next),
      onConnectionState: (connState) => {
        if (connState === 'failed') {
          window.clearTimeout(retryTimerRef.current)
          retryTimerRef.current = window.setTimeout(() => requestStream('force'), 2000)
        }
      },
    })
    return () => {
      window.clearTimeout(retryTimerRef.current)
      viewerRef.current?.close()
    }
  }, [requestStream])

  useEffect(() => {
    setHandlers({
      onJoined: () => {
        requestStream('force')
      },
      onSignal: ({ from, signal }) => {
        viewerRef.current?.handleSignal(from, signal)
      },
      onAdminLeft: () => setMedia({
        screen: null,
        camera: null,
        playback: null,
        combined: null,
        hasVideo: false,
        hasAudio: false,
        connectionState: 'closed',
        iceState: 'closed',
      }),
      onOrderToast: pushToast,
      onWinner: ({ color }) => {
        const mine = (stateRef.current?.ordersByColor?.[color] || []).find(
          (o) => o.participantId === youRef.current?.id,
        )
        setResultBanner({
          color,
          won: Boolean(mine),
          detail: mine
            ? `Pediste x${mine.quantity} de ${color}`
            : 'No tenías fichas de ese color en esta ronda',
        })
      },
    })
  }, [setHandlers, requestStream, pushToast])

  // Cuando el admin pone streamActive: pedir una vez + un reintento suave
  useEffect(() => {
    if (!state.streamActive) return undefined
    requestStream('force')
    const retry = window.setTimeout(() => {
      if (!stateRef.current) return
      requestStream('force')
    }, 1800)
    return () => window.clearTimeout(retry)
  }, [state.streamActive, state.cameraActive, state.screenActive, requestStream])

  const seenWinnerRound = useRef(null)
  useEffect(() => {
    if (state.status !== 'result' || !state.winningColor) return
    const key = `${state.round}-${state.winningColor}`
    if (seenWinnerRound.current === key) return
    seenWinnerRound.current = key
    const color = state.winningColor
    const mine = (state.ordersByColor?.[color] || []).find((o) => o.participantId === you?.id)
    setResultBanner({
      color,
      won: Boolean(mine),
      detail: mine
        ? `Pediste x${mine.quantity} de ${color}`
        : 'No tenías fichas de ese color en esta ronda',
    })
  }, [state.status, state.winningColor, state.round, state.ordersByColor, you])

  const message = useMemo(() => {
    if (state.status === 'result' && state.winningColor) return `Resultado: gana ${state.winningColor}`
    if (state.status === 'closed') return 'Compras cerradas · esperando color ganador'
    if (media.hasVideo && (media.connectionState === 'connected' || media.iceState === 'connected' || media.iceState === 'completed')) {
      return 'Conectado · si ves negro toca Reconectar video'
    }
    if (media.hasVideo) return 'Señal recibida · cargando imagen…'
    if (state.streamActive) return 'Conectando video/audio con el admin…'
    return 'Esperando que el admin pulse Iniciar en vivo'
  }, [state, media])

  if (!credentials || (error && !connected)) {
    return (
      <>
        <JoinGate
          title="Entrar al vivo"
          subtitle={linkPin
            ? `Sala #${roomKey} · entrando con tu link…`
            : `Sala #${roomKey} · solo escribe tu PIN`}
          pinOnly
          codeLabel="Tu PIN de acceso"
          codeHint="PIN de tu invitación"
          defaultCode={linkPin}
          submitLabel="Entrar al vivo"
          error={error}
          onSubmit={({ code }) => {
            setError('')
            setCredentials({ name: 'jugador', code })
          }}
        />
        <p className="home-switch">
          Demo sala <b>{DEMO_ACCESS_CODE}</b> · <Link to={`/admin/${roomKey}`}>Soy admin</Link>
        </p>
      </>
    )
  }

  if (!connected) {
    return (
      <div className="join-gate">
        <div className="join-card">
          <h1>Conectando…</h1>
          <p>Entrando a #{roomKey} con tu PIN</p>
        </div>
      </div>
    )
  }

  return (
    <RoomArena
      role="viewer"
      roomId={roomKey}
      you={you}
      state={state}
      message={message}
      remoteScreen={media.playback || media.screen || media.camera}
      remoteCamera={media.camera && media.screen ? media.camera : null}
      remoteStream={media.playback || media.combined}
      mediaConnection={media.connectionState}
      onRetryStream={() => requestStream('force')}
      toasts={toasts}
      onSendChat={(text) => send({ type: 'chat', text })}
      onOrder={(color, quantity) => send({ type: 'order', color, quantity })}
      resultBanner={resultBanner}
      onDismissResult={() => setResultBanner(null)}
    />
  )
}
