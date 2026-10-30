import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JoinGate } from '../components/JoinGate'
import { RoomArena } from '../components/RoomArena'
import { useRoom } from '../hooks/useRoom'
import { DEMO_ADMIN_PIN, DEFAULT_ROOM } from '../lib/constants'
import { createBroadcaster } from '../lib/webrtcBroadcast'

export function AdminPage() {
  const { roomId = DEFAULT_ROOM } = useParams()
  const roomKey = roomId.toUpperCase()
  const [credentials, setCredentials] = useState(null)
  const [message, setMessage] = useState('Fuera del aire · pulsa Iniciar en vivo')
  const [screenStream, setScreenStream] = useState(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [micStream, setMicStream] = useState(null)
  const [micMuted, setMicMuted] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [isCropping, setIsCropping] = useState(false)
  const [cropRect] = useState({ x: 20, y: 15, width: 60, height: 70 })
  const [savedCropRect, setSavedCropRect] = useState(null)
  const [confirmColor, setConfirmColor] = useState(null)
  const [toasts, setToasts] = useState([])
  const [resultBanner, setResultBanner] = useState(null)

  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const mixedStreamRef = useRef(null)
  const broadcasterRef = useRef(null)
  const screenStreamRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const micStreamRef = useRef(null)
  const micMutedRef = useRef(true)
  const viewerIdsRef = useRef(new Set())
  const skipRepublishRef = useRef(false)
  const republishTimerRef = useRef(null)
  const busyMediaRef = useRef(false)

  const { state, you, error, connected, send, setHandlers, setError } = useRoom({
    roomId: roomKey,
    role: 'admin',
    enabled: Boolean(credentials),
    credentials,
  })

  const liveLink = useMemo(() => `${window.location.origin}/live/${roomKey}`, [roomKey])
  const onAir = Boolean(screenStream || cameraStream)

  useEffect(() => { screenStreamRef.current = screenStream }, [screenStream])
  useEffect(() => { cameraStreamRef.current = cameraStream }, [cameraStream])
  useEffect(() => { micStreamRef.current = micStream }, [micStream])
  useEffect(() => { micMutedRef.current = micMuted }, [micMuted])

  const pushToast = useCallback((order) => {
    setToasts((current) => [...current, order].slice(-5))
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== order.id))
    }, 4200)
  }, [])

  const buildOutgoingStream = useCallback(() => {
    const tracks = []
    const screen = screenStreamRef.current
    const camera = cameraStreamRef.current
    const mic = micStreamRef.current

    if (screen) {
      for (const track of screen.getVideoTracks()) {
        track._luditoRole = 'screen'
        track.contentHint = 'detail'
        tracks.push(track)
      }
    }
    if (camera) {
      for (const track of camera.getVideoTracks()) {
        track._luditoRole = 'camera'
        track.contentHint = 'motion'
        tracks.push(track)
      }
    }
    // Mic siempre en el stream si existe: mute = track.enabled false (sin renegociar)
    if (mic) {
      for (const track of mic.getAudioTracks()) {
        track._luditoRole = 'audio'
        track.enabled = !micMutedRef.current
        tracks.push(track)
      }
    }

    const mixed = new MediaStream(tracks)
    mixedStreamRef.current = mixed
    return mixed
  }, [])

  const republish = useCallback(async ({ force = false } = {}) => {
    buildOutgoingStream()
    const ids = [...viewerIdsRef.current]
    if (!ids.length) return
    await broadcasterRef.current?.republishAll(ids, { force })
  }, [buildOutgoingStream])

  const scheduleRepublish = useCallback((opts) => {
    window.clearTimeout(republishTimerRef.current)
    republishTimerRef.current = window.setTimeout(() => {
      republish(opts)
    }, 350)
  }, [republish])

  useEffect(() => {
    broadcasterRef.current = createBroadcaster({
      sendSignal: (to, signal) => send({ type: 'signal', to, signal }),
      getLocalStream: () => mixedStreamRef.current || buildOutgoingStream(),
    })
    return () => {
      window.clearTimeout(republishTimerRef.current)
      broadcasterRef.current?.close()
    }
  }, [send, buildOutgoingStream])

  useEffect(() => {
    setHandlers({
      onViewerReady: ({ viewerId }) => {
        viewerIdsRef.current.add(viewerId)
        const push = async (force) => {
          buildOutgoingStream()
          const stream = mixedStreamRef.current
          if (!stream || stream.getTracks().length === 0) return false
          return broadcasterRef.current?.connectViewer(viewerId, { force })
        }
        // Viewer nuevo: SIEMPRE oferta fresca (si no, entra y ve negro)
        void (async () => {
          let ok = await push(true)
          if (!ok) {
            window.setTimeout(() => { void push(true) }, 700)
            window.setTimeout(() => { void push(true) }, 2000)
          }
        })()
      },
      onSignal: ({ from, signal }) => {
        broadcasterRef.current?.handleSignal(from, signal)
      },
      onOrderToast: pushToast,
      onWinner: ({ color }) => {
        setResultBanner({
          color,
          detail: 'Declaraste el color ganador de esta ronda',
        })
      },
    })
  }, [setHandlers, buildOutgoingStream, pushToast])

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream
      if (screenStream) screenVideoRef.current.play().catch(() => {})
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream
      if (cameraStream) cameraVideoRef.current.play().catch(() => {})
    }
  }, [screenStream, cameraStream])

  useEffect(() => {
    let frameId
    const renderScreen = () => {
      const video = screenVideoRef.current
      const canvas = screenCanvasRef.current
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        const bounds = canvas.getBoundingClientRect()
        const width = Math.max(1, Math.round(bounds.width * window.devicePixelRatio))
        const height = Math.max(1, Math.round(bounds.height * window.devicePixelRatio))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        const context = canvas.getContext('2d')
        const crop = savedCropRect
        const sourceX = crop ? (video.videoWidth * crop.x) / 100 : 0
        const sourceY = crop ? (video.videoHeight * crop.y) / 100 : 0
        const sourceWidth = crop ? (video.videoWidth * crop.width) / 100 : video.videoWidth
        const sourceHeight = crop ? (video.videoHeight * crop.height) / 100 : video.videoHeight
        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
      }
      frameId = requestAnimationFrame(renderScreen)
    }
    frameId = requestAnimationFrame(renderScreen)
    return () => cancelAnimationFrame(frameId)
  }, [savedCropRect])

  // Aviso de estado a la sala (no regenera WebRTC)
  useEffect(() => {
    const active = Boolean(screenStream || cameraStream)
    setIsLive(active)
    send({
      type: 'stream_status',
      active,
      micMuted,
      cameraActive: Boolean(cameraStream),
      screenActive: Boolean(screenStream),
    })
  }, [screenStream, cameraStream, micMuted, send])

  // Solo pantalla/cámara cambian la topología de tracks → republish con debounce
  useEffect(() => {
    if (skipRepublishRef.current) {
      skipRepublishRef.current = false
      buildOutgoingStream()
      return undefined
    }
    scheduleRepublish({ force: false })
    return () => window.clearTimeout(republishTimerRef.current)
  }, [screenStream, cameraStream, scheduleRepublish, buildOutgoingStream])

  // Mic: enabled on/off sin cortar la PC de los viewers
  useEffect(() => {
    if (!micStream) return
    micStream.getAudioTracks().forEach((t) => {
      t._luditoRole = 'audio'
      t.enabled = !micMuted
    })
    buildOutgoingStream()
    broadcasterRef.current?.setAudioEnabled(!micMuted)
  }, [micMuted, micStream, buildOutgoingStream])

  // Primera vez que aparece el mic en el mix: engancharlo a peers (o republish suave)
  useEffect(() => {
    if (!micStream) return
    buildOutgoingStream()
    scheduleRepublish({ force: false })
  }, [micStream, buildOutgoingStream, scheduleRepublish])

  useEffect(() => () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const stopScreen = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    setScreenStream(null)
    setSavedCropRect(null)
  }, [])

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    setCameraStream(null)
  }, [])

  // Calidad moderada: menos CPU en admin + TURN free más estable
  const displayMediaOptions = {
    video: {
      cursor: 'motion',
      frameRate: { ideal: 24, max: 30 },
      displaySurface: 'monitor',
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
    },
    audio: false,
    surfaceSwitching: 'include',
    selfBrowserSurface: 'exclude',
    preferCurrentTab: false,
    monitorTypeSurfaces: 'include',
  }

  const bindScreenTrackEnd = (stream) => {
    const track = stream?.getVideoTracks?.()[0]
    if (!track) return
    track._luditoRole = 'screen'
    track.onended = () => {
      stopScreen()
      const camStill = Boolean(cameraStreamRef.current)
      setMessage(camStill
        ? 'Pantalla detenida · cámara y sala siguen al aire'
        : 'Pantalla detenida')
    }
  }

  const startScreen = async () => {
    try {
      const next = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
      bindScreenTrackEnd(next)
      setScreenStream(next)
      setMessage('Pantalla al aire · tip: elige “Pantalla completa” para cambiar de ventana sin cortar')
      return next
    } catch (err) {
      if (err.name !== 'NotAllowedError') setMessage('No se pudo compartir pantalla')
      return null
    }
  }

  /** Cambia la ventana/pantalla sin cortar el en vivo (cámara/mic siguen). */
  const changeScreen = async () => {
    try {
      setMessage('Elige la nueva ventana o pantalla…')
      const next = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
      const newTrack = next.getVideoTracks()[0]
      if (!newTrack) {
        next.getTracks().forEach((t) => t.stop())
        setMessage('No se obtuvo video de pantalla')
        return null
      }

      bindScreenTrackEnd(next)
      const previous = screenStreamRef.current

      if (previous) {
        skipRepublishRef.current = true
        const replaced = await broadcasterRef.current?.replaceTrackByRole('screen', newTrack)
        setScreenStream(next)
        previous.getTracks().forEach((t) => t.stop())
        if (!replaced) {
          skipRepublishRef.current = false
          await republish()
        }
      } else {
        setScreenStream(next)
      }

      setMessage('Fuente cambiada · sigues en vivo')
      return next
    } catch (err) {
      if (err.name !== 'NotAllowedError') setMessage('No se pudo cambiar la pantalla')
      else setMessage('Cambio cancelado · el en vivo sigue')
      return null
    }
  }

  const startCamera = async () => {
    try {
      if (cameraStreamRef.current) return cameraStreamRef.current
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 20, max: 24 },
        },
        audio: false,
      })
      next.getVideoTracks()[0].onended = () => {
        stopCamera()
        setMessage('Cámara detenida')
      }
      setCameraStream(next)
      setMessage('Cámara al aire')
      return next
    } catch (err) {
      if (err.name === 'NotAllowedError') setMessage('Permiso de cámara rechazado')
      else setMessage('No se pudo iniciar la cámara')
      return null
    }
  }

  const ensureMic = async () => {
    if (micStreamRef.current) return micStreamRef.current
    const next = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    next.getAudioTracks().forEach((t) => {
      t._luditoRole = 'audio'
      t.enabled = !micMutedRef.current
    })
    setMicStream(next)
    return next
  }

  const toggleMic = async () => {
    if (busyMediaRef.current) return
    busyMediaRef.current = true
    try {
      if (micMuted) {
        await ensureMic()
        setMicMuted(false)
        send({ type: 'mic', muted: false })
        setMessage('Micrófono activo · te escuchan')
      } else {
        micStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false })
        setMicMuted(true)
        send({ type: 'mic', muted: true })
        setMessage('Micrófono muteado')
      }
    } catch {
      setMessage('No se pudo acceder al micrófono')
    } finally {
      busyMediaRef.current = false
    }
  }

  const startLive = async () => {
    if (busyMediaRef.current) return
    busyMediaRef.current = true
    setMessage('Iniciando en vivo…')
    try {
      const screen = screenStreamRef.current || await startScreen()
      if (!cameraStreamRef.current) await startCamera()
      if (micMutedRef.current) {
        try {
          await ensureMic()
          setMicMuted(false)
          send({ type: 'mic', muted: false })
        } catch {
          /* mic optional */
        }
      }
      buildOutgoingStream()
      // Una sola publicación fuerte a todos los viewers conectados
      await republish({ force: true })
      if (screen || cameraStreamRef.current) {
        setMessage('EN VIVO · los viewers ya pueden verte')
      }
    } finally {
      busyMediaRef.current = false
    }
  }

  const stopLive = () => {
    stopScreen()
    stopCamera()
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    setMicStream(null)
    setMicMuted(true)
    setIsLive(false)
    setMessage('Fuera del aire · transmisión detenida')
    send({ type: 'stream_status', active: false, micMuted: true, cameraActive: false, screenActive: false })
  }

  if (!credentials || (!connected && error)) {
    return (
      <>
        <JoinGate
          title="Panel administrador"
          subtitle={`Sala #${roomKey} · PIN admin (demo: ${DEMO_ADMIN_PIN})`}
          nameLabel="Tu nombre de host"
          codeLabel="PIN de administrador"
          codeHint={DEMO_ADMIN_PIN}
          defaultCode={DEMO_ADMIN_PIN}
          submitLabel="Entrar como admin"
          error={error}
          onSubmit={({ name, code }) => {
            setError('')
            setCredentials({ name, code })
          }}
        />
        <p className="home-switch">
          ¿Eres espectador? <Link to={`/live/${roomKey}`}>Entrar al vivo</Link>
        </p>
      </>
    )
  }

  if (!connected) {
    return <div className="join-gate"><div className="join-card"><h1>Conectando…</h1><p>Uniendo a la sala #{roomKey}</p></div></div>
  }

  return (
    <>
      <RoomArena
        role="admin"
        roomId={roomKey}
        you={you}
        state={state}
        message={message}
        liveLink={liveLink}
        screenVideoRef={screenVideoRef}
        screenCanvasRef={screenCanvasRef}
        cameraVideoRef={cameraVideoRef}
        isCropping={isCropping}
        cropRect={cropRect}
        screenStream={screenStream}
        cameraStream={cameraStream}
        micMuted={micMuted}
        isLive={onAir || isLive}
        toasts={toasts}
        resultBanner={resultBanner}
        onDismissResult={() => setResultBanner(null)}
        onStartLive={startLive}
        onStopLive={stopLive}
        onToggleScreen={() => {
          if (busyMediaRef.current) return
          if (screenStream) {
            stopScreen()
            setMessage(cameraStream
              ? 'Pantalla detenida · cámara sigue al aire'
              : 'Pantalla detenida')
          } else {
            startScreen()
          }
        }}
        onChangeScreen={changeScreen}
        onToggleCamera={() => {
          if (busyMediaRef.current) return
          if (cameraStream) {
            stopCamera()
            setMessage('Cámara detenida')
          } else {
            startCamera()
          }
        }}
        onToggleMic={toggleMic}
        onCrop={() => {
          if (isCropping && screenStream) {
            setSavedCropRect(cropRect)
            setIsCropping(false)
            setMessage('Área recortada aplicada')
            return
          }
          setSavedCropRect(null)
          setIsCropping(true)
        }}
        onCopyLink={async () => {
          try {
            await navigator.clipboard.writeText(liveLink)
            setMessage('Link de viewers copiado')
          } catch {
            setMessage(liveLink)
          }
        }}
        onSendChat={(text) => send({ type: 'chat', text })}
        onDeclareWinner={(color) => setConfirmColor(color)}
        onCloseOrders={() => send({ type: 'close_orders' })}
        onOpenOrders={() => send({ type: 'open_orders' })}
        onNewRound={() => send({ type: 'new_round' })}
        onCreateInvite={({ name, pin }) => send({ type: 'create_invite', name, pin })}
        onDeleteInvite={(pin) => send({ type: 'delete_invite', pin })}
      />

      {confirmColor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setConfirmColor(null)}>
          <section className="token-modal">
            <h2>¿Gana {confirmColor}?</h2>
            <p className="modal-subtitle">Se avisará a todos los espectadores de la sala.</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" onClick={() => setConfirmColor(null)}>Cancelar</button>
              <button
                type="button"
                className="modal-confirm"
                onClick={() => {
                  const color = confirmColor
                  send({ type: 'set_winner', color })
                  setConfirmColor(null)
                  setMessage(`Ganador: ${color}`)
                  setResultBanner({
                    color,
                    detail: 'Declaraste el color ganador de esta ronda',
                  })
                }}
              >
                Confirmar
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
