import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [muted, setMuted] = useState(false)
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

  useEffect(() => {
    const node = viewerVideoRef.current
    if (!node) return
    if (mainRemote && node.srcObject !== mainRemote) {
      node.srcObject = mainRemote
      node.play().catch(() => {})
    }
    if (!mainRemote) node.srcObject = null
  }, [mainRemote])

  useEffect(() => {
    const node = viewerCameraRef.current
    if (!node) return
    if (remoteCamera && node.srcObject !== remoteCamera) {
      node.srcObject = remoteCamera
      node.play().catch(() => {})
    }
    if (!remoteCamera) node.srcObject = null
  }, [remoteCamera])

  useEffect(() => {
    const apply = (node) => {
      if (!node) return
      node.volume = volume
      node.muted = muted
    }
    apply(viewerVideoRef.current)
    apply(viewerCameraRef.current)
  }, [volume, muted, mainRemote, remoteCamera])

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
              <video className="viewer-video" autoPlay playsInline ref={viewerVideoRef} />
            ) : (
              <div className="empty-preview viewer-empty">
                <div className="empty-icon"><Icon name="monitor" /></div>
                <h2>{state.streamActive ? 'Conectando al directo…' : 'Esperando transmisión'}</h2>
                <p>Cuando el admin pulse “Iniciar en vivo”, lo verás aquí.</p>
              </div>
            )}
            {remoteCamera && (
              <video className="viewer-camera-pip" autoPlay playsInline muted={muted} ref={viewerCameraRef} />
            )}
            {state.streamActive && (
              <span className={`mic-pill ${state.micMuted ? 'muted' : ''}`}>
                {state.micMuted ? 'Admin muteado' : 'Admin hablando'}
              </span>
            )}
            {liveNow || state.streamActive ? (
              <span className={`viewer-live-badge ${mainRemote ? 'ok' : 'wait'}`}>
                {mainRemote ? 'EN VIVO' : 'SIN SEÑAL'}
              </span>
            ) : null}
          </div>

          <div className="viewer-volume-bar">
            <button
              type="button"
              className="ghost-btn volume-mute-btn"
              onClick={() => setMuted((value) => !value)}
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
            <span>{Math.round((muted ? 0 : volume) * 100)}%</span>
            <button type="button" className="ghost-btn view-orders-btn" onClick={() => setHistoryOpen(true)}>
              Ver compras
            </button>
          </div>

          <div className="quick-color-bar">
            <div className="quick-color-head">
              <strong>Pedir color</strong>
              <small>{canOrder ? 'Toca un color · cerca del vivo' : 'Compras cerradas'}</small>
            </div>
            <div className="quick-color-grid">
              {COLORS.map((column) => (
                <button
                  type="button"
                  key={column.name}
                  className={`quick-color-btn ${column.className}`}
                  disabled={!canOrder}
                  onClick={() => openColor(column)}
                >
                  <span>{column.name}</span>
                  <b>x{state.totals?.[column.name] || 0}</b>
                </button>
              ))}
            </div>
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

  return (
    <main className="ludo-app">
      <header className="ludo-header">
        <div className="ludo-brand">
          <span className="crown">♛</span>
          <div>
            <b>LUDO <em>KING</em></b>
            <small>LIVE ARENA</small>
          </div>
        </div>
        <div className="room-title">
          <span className="live-dot" /> SALA EN VIVO <strong>#{roomId}</strong>
          {you && <em className="you-chip"> · {you.name}</em>}
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
        </div>
      </header>

      <div className="ludo-layout">
        <section className="arena-column">
          <div className="hero-banner">
            <img src="/assets/ludo-1.png" alt="Ludo King Dance Season" />
            <div>
              <p>EVENTO ESPECIAL</p>
              <h1>Ludo King<br /><span>Dance Season</span></h1>
              <button type="button" className="gold-btn">Ronda {state.round} · {state.status}</button>
            </div>
          </div>

          {isAdmin ? (
            <>
              {streamBlock}
              {boardBlock}
            </>
          ) : (
            <>
              {streamBlock}
              {boardBlock}
            </>
          )}

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
        </section>

        <aside className="ludo-sidebar">
          {isAdmin && (
            <InvitesPanel
              invites={state.invites || []}
              liveLink={liveLink}
              onCreate={onCreateInvite}
              onDelete={onDeleteInvite}
            />
          )}

          {!isAdmin && (
            <div className="art-card">
              <img src="/assets/ludo-2.png" alt="Ludo King" />
              <div>
                <b>EL REY HA LLEGADO</b>
                <span>Juega. Baila. Domina.</span>
              </div>
            </div>
          )}

          <div className="side-card">
            <div className="side-head">
              <h3>Jugadores</h3>
              <span>{viewers.length} en vivo <i className="online-dot" /></span>
            </div>
            {viewers.length === 0 && <p className="side-empty">Aún no hay espectadores</p>}
            {viewers.slice(0, 8).map((player) => (
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

          <div className="side-card activity">
            <div className="side-head">
              <h3>Actividad en vivo</h3>
              <span className="live-label">● EN VIVO</span>
            </div>
            {(state.activity || []).slice().reverse().map((line, index) => (
              <p key={`${line}-${index}`}>🎲 {line}</p>
            ))}
          </div>

          <ChatPanel
            messages={state.chat}
            onlineCount={state.viewerCount + (participants.some((p) => p.role === 'admin') ? 1 : 0)}
            canOrder={canOrder}
            onSend={(text) => onSendChat?.(text)}
            onReact={(emoji) => onSendChat?.(emoji)}
            onOrder={onOrder}
            onPickColor={openColor}
          />
        </aside>
      </div>

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
