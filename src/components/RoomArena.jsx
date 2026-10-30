import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COLORS } from '../lib/constants'
import { Icon } from './Icon'
import { TokenBoard } from './TokenBoard'
import { ChatPanel } from './ChatPanel'
import { OrderModal } from './OrderModal'
import { OrdersHistoryModal } from './OrdersHistoryModal'
import { InvitesPanel } from './InvitesPanel'
import { WinnerCelebration } from './WinnerCelebration'

export function RoomArena({
  role,
  roomId,
  you,
  state,
  message,
  liveLink,
  remoteStream,
  remoteScreen,
  remoteCamera,
  mediaConnection,
  onRetryStream,
  screenVideoRef,
  screenCanvasRef,
  cameraVideoRef,
  isCropping,
  cropRect,
  screenStream,
  cameraStream,
  micMuted,
  isLive,
  onStartLive,
  onStopLive,
  onToggleScreen,
  onChangeScreen,
  onToggleCamera,
  onToggleMic,
  onCrop,
  onCopyLink,
  onSendChat,
  onOrder,
  onDeclareWinner,
  onCloseOrders,
  onOpenOrders,
  onNewRound,
  onCreateInvite,
  onDeleteInvite,
  resultBanner,
  onDismissResult,
  toasts = [],
}) {
  const [activeColumn, setActiveColumn] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [volume, setVolume] = useState(0.85)
  // Sonido solo tras gesto: si el <video> no está muted, el navegador bloquea y queda NEGRO
  const [soundOn, setSoundOn] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(true)
  const [hasFrames, setHasFrames] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const [sideTab, setSideTab] = useState('players')
  const viewerVideoRef = useRef(null)
  const viewerCameraRef = useRef(null)
  const attachedMainKey = useRef('')

  const isAdmin = role === 'admin'
  const canOrder = !isAdmin && state.status === 'open'
  const participants = state.participants || []
  const viewers = participants.filter((p) => p.role === 'viewer')
  const liveNow = Boolean(isLive || screenStream || cameraStream)

  const myOrders = useMemo(() => {
    if (!you) return []
    return Object.entries(state.ordersByColor || {}).flatMap(([color, list]) =>
      list
        .filter((o) => o.participantId === you.id)
        .map((o) => ({ color, quantity: o.quantity })),
    )
  }, [state.ordersByColor, you])

  const mainRemote = remoteScreen || remoteStream

  const streamKey = (stream) => {
    if (!stream) return ''
    return stream.getTracks().map((t) => t.id).join(',')
  }

  const tryPlayMuted = useCallback(async (node) => {
    if (!node) return false
    node.playsInline = true
    node.setAttribute('playsinline', '')
    node.setAttribute('webkit-playsinline', '')
    node.muted = true
    node.volume = volume
    try {
      await node.play()
      return true
    } catch {
      setNeedsGesture(true)
      return false
    }
  }, [volume])

  useEffect(() => {
    const node = viewerVideoRef.current
    if (!node) return
    if (!mainRemote) {
      node.srcObject = null
      attachedMainKey.current = ''
      setHasFrames(false)
      return
    }
    const key = streamKey(mainRemote)
    if (attachedMainKey.current !== key) {
      attachedMainKey.current = key
      node.srcObject = mainRemote
      setHasFrames(false)
    }
    // Siempre reproducir muteado primero (garantiza imagen)
    node.muted = !soundOn
    tryPlayMuted(node).then(() => {
      if (soundOn) {
        node.muted = false
        node.play().catch(() => {
          node.muted = true
          setSoundOn(false)
          setNeedsGesture(true)
        })
      }
    })
  }, [mainRemote, tryPlayMuted, soundOn])

  useEffect(() => {
    const node = viewerCameraRef.current
    if (!node) return
    if (remoteCamera) {
      if (node.srcObject !== remoteCamera) node.srcObject = remoteCamera
      node.muted = true
      node.play().catch(() => {})
    } else {
      node.srcObject = null
    }
  }, [remoteCamera])

  useEffect(() => {
    const node = viewerVideoRef.current
    if (!node?.srcObject) return
    node.volume = volume
    if (soundOn) {
      node.muted = false
      node.play().catch(() => {
        node.muted = true
        setSoundOn(false)
        setNeedsGesture(true)
      })
    } else {
      node.muted = true
    }
  }, [volume, soundOn])

  // Detectar frames reales (si no hay, el cartel "en vivo" mentía)
  useEffect(() => {
    if (!mainRemote) {
      setHasFrames(false)
      return undefined
    }
    const tick = () => {
      const node = viewerVideoRef.current
      const ok = Boolean(node && node.videoWidth > 2 && !node.paused)
      setHasFrames(ok)
    }
    tick()
    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [mainRemote])

  // Si hay señal de sala pero no hay frames, re-pedir stream
  useEffect(() => {
    if (isAdmin || !state.streamActive || hasFrames) return undefined
    const timer = window.setTimeout(() => {
      if (!hasFrames) onRetryStream?.()
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [isAdmin, state.streamActive, hasFrames, onRetryStream, mainRemote])

  const unlockAudio = useCallback(() => {
    const node = viewerVideoRef.current
    if (!node) return
    setSoundOn(true)
    setNeedsGesture(false)
    node.muted = false
    node.volume = volume || 0.85
    node.play().catch(() => {
      node.muted = true
      setSoundOn(false)
      setNeedsGesture(true)
    })
  }, [volume])

  const openColor = (column) => {
    setActiveColumn(column)
    const existing = (state.ordersByColor[column.name] || []).find((o) => o.participantId === you?.id)
    setQuantity(existing?.quantity || 1)
  }

  const updateQuantity = (next) => {
    const parsed = Number(next)
    setQuantity(Number.isFinite(parsed) ? Math.min(99, Math.max(1, Math.floor(parsed))) : 1)
  }

  const colorClass = (name) => COLORS.find((c) => c.name === name)?.className || ''

  const streamBlock = (
    <div className="stream-card">
      <div className="stream-card-head">
        <div>
          <span className="eyebrow">{isAdmin ? 'ESTUDIO DE TRANSMISIÓN' : 'EN VIVO'}</span>
          <h2>{isAdmin ? 'Vista del presentador' : 'Transmisión de la sala'}</h2>
        </div>
        <span className={`stream-note ${liveNow ? 'is-onair' : ''}`}>{message}</span>
      </div>

      {isAdmin ? (
        <>
          <div className={`live-status-banner ${liveNow ? 'on' : 'off'}`}>
            <span className="live-status-dot" />
            <strong>{liveNow ? 'EN VIVO AHORA' : 'FUERA DEL AIRE'}</strong>
            <small>
              {liveNow
                ? `${screenStream ? 'Pantalla' : ''}${screenStream && cameraStream ? ' + ' : ''}${cameraStream ? 'Cámara' : ''}${!micMuted ? ' · Mic ON' : ' · Mic OFF'}`
                : 'Los viewers no ven nada hasta que inicies'}
            </small>
          </div>

          <div className="stream-preview">
            <div className="source-preview game-screen">
              <span className="source-badge"><Icon name="monitor" /> PANTALLA</span>
              {!screenStream && (
                <div className="empty-preview">
                  <div className="empty-icon"><Icon name="monitor" /></div>
                  <h2>Pantalla apagada</h2>
                  <p>Pulsa Iniciar en vivo o Compartir pantalla.</p>
                </div>
              )}
              <video ref={screenVideoRef} className="screen-source-video" muted playsInline />
              <canvas ref={screenCanvasRef} className="screen-canvas" />
              {isCropping && screenStream && (
                <div
                  className="crop-frame"
                  style={{
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.width}%`,
                    height: `${cropRect.height}%`,
                  }}
                >
                  <label>SELECCIÓN</label>
                </div>
              )}
            </div>
            <div className="source-preview game-camera">
              <span className="source-badge"><Icon name="video" /> CÁMARA</span>
              {!cameraStream && (
                <div className="empty-preview">
                  <div className="empty-icon"><Icon name="video" /></div>
                  <h2>Cámara apagada</h2>
                  <p>Actívala para que te vean en PiP.</p>
                </div>
              )}
              <video ref={cameraVideoRef} className="camera-video" muted playsInline />
            </div>
          </div>

          <div className="live-master-controls">
            {!liveNow ? (
              <button type="button" className="go-live-btn" onClick={onStartLive}>
                <Icon name="play" /> Iniciar en vivo
              </button>
            ) : (
              <button type="button" className="stop-live-btn" onClick={onStopLive}>
                <Icon name="stop" /> Terminar en vivo
              </button>
            )}
          </div>

          <div className="stream-controls">
            <button type="button" className={`secondary-action ${screenStream ? 'is-on' : ''}`} onClick={onToggleScreen}>
              {screenStream ? 'Pantalla ON' : 'Pantalla OFF'}
            </button>
            {screenStream && (
              <button type="button" className="secondary-action change-screen-btn" onClick={onChangeScreen}>
                Cambiar ventana
              </button>
            )}
            <button type="button" className={`secondary-action ${cameraStream ? 'is-on' : ''}`} onClick={onToggleCamera}>
              {cameraStream ? 'Cámara ON' : 'Cámara OFF'}
            </button>
            <button type="button" className={`secondary-action ${micMuted ? 'is-muted' : 'is-on'}`} onClick={onToggleMic}>
              <Icon name={micMuted ? 'mute' : 'mic'} /> {micMuted ? 'Mic OFF' : 'Mic ON'}
            </button>
            <button type="button" className="crop-control" onClick={onCrop}>
              <Icon name="crop" /> {isCropping ? 'Aplicar recorte' : 'Recortar'}
            </button>
            <button type="button" className="ghost-btn copy-link-btn" onClick={onCopyLink}>
              <Icon name="copy" /> Copiar link
            </button>
          </div>
          {screenStream && (
            <p className="screen-share-tip">
              Tip: comparte <b>Pantalla completa</b> para cambiar de app sin cortar. O usa <b>Cambiar ventana</b> sin terminar el en vivo.
            </p>
          )}
          <div className="admin-round-controls">
            {state.status === 'open' ? (
              <button type="button" className="secondary-action" onClick={onCloseOrders}>Cerrar compras</button>
            ) : (
              <button type="button" className="secondary-action" onClick={onOpenOrders}>Abrir compras</button>
            )}
            <button type="button" className="primary-action" onClick={onNewRound}>Nueva ronda</button>
          </div>
        </>
      ) : (
        <>
          <div className="viewer-stage">
            {mainRemote ? (
              <video className="viewer-video" autoPlay playsInline muted={!soundOn} ref={viewerVideoRef} />
            ) : (
              <div className="empty-preview viewer-empty">
                <div className="empty-icon"><Icon name="monitor" /></div>
                <h2>{state.streamActive ? 'Conectando al directo…' : 'Esperando transmisión'}</h2>
                <p>Cuando el admin pulse “Iniciar en vivo”, lo verás aquí.</p>
                {state.streamActive && (
                  <button type="button" className="primary-action" onClick={() => onRetryStream?.()}>
                    Reintentar video
                  </button>
                )}
              </div>
            )}
            {remoteCamera && (
              <video className="viewer-camera-pip" autoPlay playsInline muted ref={viewerCameraRef} />
            )}
            {state.streamActive && (
              <span className={`mic-pill ${state.micMuted ? 'muted' : ''}`}>
                {state.micMuted ? 'Admin muteado' : 'Admin hablando'}
              </span>
            )}
            {liveNow || state.streamActive ? (
              <span className={`viewer-live-badge ${hasFrames ? 'ok' : 'wait'}`}>
                {hasFrames ? 'EN VIVO' : 'SIN IMAGEN'}
              </span>
            ) : null}
            {mainRemote && !hasFrames && (
              <button type="button" className="viewer-unlock-audio" onClick={() => onRetryStream?.()}>
                Reconectar video
              </button>
            )}
            {needsGesture && hasFrames && !soundOn && (
              <button type="button" className="viewer-unlock-audio" onClick={unlockAudio}>
                <Icon name="audio" /> Toca para oír el en vivo
              </button>
            )}
            {(mediaConnection === 'failed' || mediaConnection === 'disconnected') && state.streamActive && (
              <button type="button" className="viewer-unlock-audio" onClick={() => onRetryStream?.()}>
                Reconectar video
              </button>
            )}
          </div>

          <div className="viewer-action-strip">
            <div className="viewer-volume-compact" title="Volumen del en vivo (altavoz · sin micrófono)">
              <button
                type="button"
                className="ghost-btn volume-mute-btn"
                onClick={() => {
                  if (!soundOn) unlockAudio()
                  else {
                    setSoundOn(false)
                    const node = viewerVideoRef.current
                    if (node) node.muted = true
                  }
                }}
                aria-label={soundOn ? 'Silenciar altavoz' : 'Activar altavoz'}
              >
                <Icon name={!soundOn || volume === 0 ? 'mute' : 'audio'} />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={soundOn ? volume : 0}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setVolume(next)
                  if (next > 0) unlockAudio()
                  else setSoundOn(false)
                }}
                aria-label="Volumen"
              />
              <span>{Math.round((soundOn ? volume : 0) * 100)}</span>
            </div>

            <div className="quick-color-inline">
              <div className="quick-color-inline-label">
                <strong>Colores</strong>
                <small>{canOrder ? 'Toca para pedir' : 'Cerrado'}</small>
              </div>
              <div className="quick-color-grid compact">
                {COLORS.map((column) => (
                  <button
                    type="button"
                    key={column.name}
                    className={`quick-color-btn ${column.className}`}
                    disabled={!canOrder}
                    onClick={() => openColor(column)}
                    title={column.name}
                  >
                    <span>{column.name.slice(0, 3)}</span>
                    <b>x{state.totals?.[column.name] || 0}</b>
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="ghost-btn view-orders-btn" onClick={() => setHistoryOpen(true)}>
              Ver compras
            </button>
          </div>
        </>
      )}
    </div>
  )

  const boardBlock = (
    <TokenBoard
      ordersByColor={state.ordersByColor}
      totals={state.totals}
      canOrder={canOrder}
      showBuyButtons={isAdmin}
      isAdmin={isAdmin}
      status={state.status}
      onSelectColor={openColor}
      onDeclareWinner={onDeclareWinner}
      onOpenHistory={() => setHistoryOpen(true)}
    />
  )

  const chatOnline = state.viewerCount + (participants.some((p) => p.role === 'admin') ? 1 : 0)
  const unreadHint = (state.chat || []).length

  const chatPanel = (
    <ChatPanel
      messages={state.chat}
      onlineCount={chatOnline}
      canOrder={canOrder}
      showColorShortcuts={isAdmin}
      onSend={(text) => onSendChat?.(text)}
      onReact={(emoji) => onSendChat?.(emoji)}
      onOrder={onOrder}
      onPickColor={openColor}
    />
  )

  return (
    <main className={`ludo-app ${isAdmin ? 'is-admin' : 'is-viewer'} ${chatOpen ? 'chat-open' : ''} ${roomOpen ? 'room-open' : ''}`}>
      <header className="ludo-header">
        <div className="ludo-brand">
          <span className="crown">♛</span>
          <div>
            <b>LUDO <em>KING</em></b>
            <small>LIVE ARENA</small>
          </div>
        </div>
        <div className="room-title">
          <span className="live-dot" /> SALA <strong>#{roomId}</strong>
          {you && <em className="you-chip"> · {you.name}</em>}
          <span className="round-chip">R{state.round} · {state.status}</span>
        </div>
        <div className="header-actions">
          <span className={`status-pill ${liveNow || state.streamActive ? 'is-live' : ''}`}>
            <i /> {liveNow || state.streamActive ? 'EN VIVO' : 'FUERA DEL AIRE'}
          </span>
          {isAdmin && liveLink && (
            <button type="button" className="ghost-btn copy-link-btn" onClick={onCopyLink} title="Copiar link de viewers">
              <Icon name="copy" /> Link
            </button>
          )}
          <button
            type="button"
            className="ghost-btn room-panel-btn"
            onClick={() => { setRoomOpen(true); setChatOpen(false) }}
            aria-label="Abrir sala"
          >
            <Icon name="users" /> Sala
            <b className="chat-badge soft">{viewers.length}</b>
          </button>
          <button
            type="button"
            className="ghost-btn chat-header-btn"
            onClick={() => { setChatOpen(true); setRoomOpen(false) }}
            aria-label="Abrir chat"
          >
            <Icon name="chat" /> Chat
            {unreadHint > 0 && <b className="chat-badge">{Math.min(99, unreadHint)}</b>}
          </button>
        </div>
      </header>

      <div className="ludo-layout live-only-layout">
        <section className="arena-column">
          <div className="live-stage-row">
            <div className="live-focus">
              {streamBlock}
            </div>

            <div className={`chat-rail ${chatOpen ? 'is-open' : ''}`}>
              <div className="chat-sheet-handle" />
              <div className="chat-sheet-head">
                <strong>Chat en vivo</strong>
                <button type="button" className="ghost-btn" onClick={() => setChatOpen(false)} aria-label="Cerrar chat">
                  <Icon name="close" />
                </button>
              </div>
              <div className="chat-rail-body">
                {chatPanel}
              </div>
            </div>
          </div>

          {!isAdmin && myOrders.length > 0 && (
            <div className="my-colors-card">
              <span className="eyebrow">MIS COLORES · RONDA {state.round}</span>
              <div className="my-colors-list">
                {myOrders.map((item) => (
                  <span key={item.color}>{item.color} <b>x{item.quantity}</b></span>
                ))}
              </div>
            </div>
          )}

          {boardBlock}
        </section>
      </div>

      <button
        type="button"
        className="chat-fab"
        onClick={() => { setChatOpen(true); setRoomOpen(false) }}
        aria-label="Abrir chat en vivo"
      >
        <Icon name="chat" />
        <span>Chat</span>
        {unreadHint > 0 && <b className="chat-badge">{Math.min(99, unreadHint)}</b>}
      </button>

      <div
        className={`chat-sheet-backdrop ${chatOpen || roomOpen ? 'is-open' : ''}`}
        onClick={() => { setChatOpen(false); setRoomOpen(false) }}
        aria-hidden={!chatOpen && !roomOpen}
      />

      <aside className={`room-drawer ${roomOpen ? 'is-open' : ''}`} aria-hidden={!roomOpen}>
        <div className="chat-sheet-handle" />
        <div className="chat-sheet-head">
          <strong>Sala</strong>
          <button type="button" className="ghost-btn" onClick={() => setRoomOpen(false)} aria-label="Cerrar sala">
            <Icon name="close" />
          </button>
        </div>
        <div className="room-drawer-body">
          {isAdmin && (
            <InvitesPanel
              invites={state.invites || []}
              liveLink={liveLink}
              onCreate={onCreateInvite}
              onDelete={onDeleteInvite}
            />
          )}

          <div className="side-tabs">
            <button
              type="button"
              className={sideTab === 'players' ? 'active' : ''}
              onClick={() => setSideTab('players')}
            >
              Jugadores ({viewers.length})
            </button>
            <button
              type="button"
              className={sideTab === 'activity' ? 'active' : ''}
              onClick={() => setSideTab('activity')}
            >
              Actividad
            </button>
          </div>

          {sideTab === 'players' && (
            <div className="side-card">
              <div className="side-head">
                <h3>Jugadores</h3>
                <span>{viewers.length} en vivo <i className="online-dot" /></span>
              </div>
              {viewers.length === 0 && <p className="side-empty">Aún no hay espectadores</p>}
              {viewers.slice(0, 12).map((player) => (
                <div className="player-row" key={player.id}>
                  <span className="player-avatar purple-bg">
                    {player.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <b>{player.name}</b>
                    <small>Conectado</small>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sideTab === 'activity' && (
            <div className="side-card activity">
              <div className="side-head">
                <h3>Actividad en vivo</h3>
                <span className="live-label">● EN VIVO</span>
              </div>
              {(state.activity || []).length === 0 && <p className="side-empty">Sin actividad aún</p>}
              {(state.activity || []).slice().reverse().map((line, index) => (
                <p key={`${line}-${index}`}>🎲 {line}</p>
              ))}
            </div>
          )}
        </div>
      </aside>

      <OrderModal
        column={activeColumn}
        quantity={quantity}
        onQuantity={updateQuantity}
        onClose={() => setActiveColumn(null)}
        onConfirm={() => {
          onOrder?.(activeColumn.name, quantity)
          setActiveColumn(null)
        }}
      />

      <OrdersHistoryModal
        open={historyOpen}
        ordersByColor={state.ordersByColor}
        round={state.round}
        onClose={() => setHistoryOpen(false)}
      />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`order-toast ${colorClass(toast.color)}`} key={toast.id}>
            <strong>{toast.name}</strong>
            <span>x{toast.quantity}</span>
            <em>{toast.color}</em>
          </div>
        ))}
      </div>

      {resultBanner?.color && (
        <WinnerCelebration
          color={resultBanner.color}
          won={resultBanner.won}
          detail={resultBanner.detail}
          onClose={() => onDismissResult?.()}
        />
      )}
    </main>
  )
}
