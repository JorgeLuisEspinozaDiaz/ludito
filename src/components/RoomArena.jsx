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
  // Empieza muteado: el autoplay del navegador bloquea video+audio juntos → pantalla negra
  const [muted, setMuted] = useState(true)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const [sideTab, setSideTab] = useState('players')
  const viewerVideoRef = useRef(null)
  const viewerCameraRef = useRef(null)

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

  const tryPlay = useCallback(async (node, withSound) => {
    if (!node) return false
    node.playsInline = true
    node.setAttribute('playsinline', '')
    node.setAttribute('webkit-playsinline', '')
    try {
      node.muted = withSound ? muted : true
      node.volume = volume
      await node.play()
      if (withSound && !muted) setNeedsGesture(false)
      return true
    } catch {
      // Autoplay con sonido bloqueado: forzar mute y reintentar
      try {
        node.muted = true
        await node.play()
        setNeedsGesture(true)
        setMuted(true)
        return true
      } catch {
        setNeedsGesture(true)
        return false
      }
    }
  }, [muted, volume])

  useEffect(() => {
    const node = viewerVideoRef.current
    if (!node) return
    if (mainRemote) {
      if (node.srcObject !== mainRemote) node.srcObject = mainRemote
      tryPlay(node, true)
    } else {
      node.srcObject = null
    }
  }, [mainRemote, tryPlay])

  useEffect(() => {
    const node = viewerCameraRef.current
    if (!node) return
    if (remoteCamera) {
      if (node.srcObject !== remoteCamera) node.srcObject = remoteCamera
      tryPlay(node, false)
    } else {
      node.srcObject = null
    }
  }, [remoteCamera, tryPlay])

  useEffect(() => {
    const apply = (node) => {
      if (!node) return
      node.volume = volume
      node.muted = muted
      if (node.srcObject) node.play().catch(() => {})
    }
    apply(viewerVideoRef.current)
  }, [volume, muted])

  const unlockAudio = useCallback(() => {
    setMuted(false)
    setNeedsGesture(false)
    const node = viewerVideoRef.current
    if (!node) return
    node.muted = false
    node.volume = volume || 0.85
    node.play().catch(() => {
      setMuted(true)
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
              <video className="viewer-video" autoPlay playsInline muted={muted} ref={viewerVideoRef} />
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
              <span className={`viewer-live-badge ${mainRemote && mediaConnection !== 'failed' ? 'ok' : 'wait'}`}>
                {mainRemote && mediaConnection !== 'failed' ? 'EN VIVO' : 'SIN SEÑAL'}
              </span>
            ) : null}
            {needsGesture && mainRemote && (
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
            <div className="viewer-volume-compact" title="Volumen">
              <button
                type="button"
                className="ghost-btn volume-mute-btn"
                onClick={() => {
                  if (muted) unlockAudio()
                  else setMuted(true)
                }}
                aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              >
                <Icon name={muted || volume === 0 ? 'mute' : 'audio'} />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setVolume(next)
                  setMuted(next === 0)
                }}
                aria-label="Volumen"
              />
              <span>{Math.round((muted ? 0 : volume) * 100)}</span>
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
