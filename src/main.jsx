import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const recentStreams = [
  { title: 'Diseño de portada', time: 'Hace 2 h', color: '#b5f36d' },
  { title: 'Demo del producto', time: 'Ayer, 18:40', color: '#cb8cff' },
  { title: 'Reunión de equipo', time: 'Ayer, 10:15', color: '#ffb86b' },
]

const ludoColumns = [
  { name: 'MORADO', className: 'purple-column', values: ['ROSITA', 'ANGELA', 'ANGELA', 'ANGIE', 'ALLISON', 'ROSITA'] },
  { name: 'AMARILLO', className: 'yellow-column', values: ['CRJ', 'CRJ', 'VALDIVIEZO', 'VALDIVIEZO', 'ANGIE', 'ROSITA'] },
  { name: 'CELESTE', className: 'cyan-column', values: ['ROSITA', 'ANGELA', 'ANGELA', 'NELSON', 'NELSON', 'NELSON'] },
  { name: 'ROJO', className: 'red-column', values: ['ROSITA', 'ANGIE', 'ANGIE', 'ALLISON', 'ROSITA', 'ANGELA'] },
  { name: 'VERDE', className: 'green-column', values: ['ALLISON', 'VALDIVIEZO', 'VALDIVIEZO', 'ALLISON', 'ROSITA', 'ROSITA'] },
  { name: 'NARANJA', className: 'orange-column', values: ['ANGIE', 'NELSON', 'NELSON', 'NELSON', 'NELSON', 'NELSON'] },
]

function Icon({ name }) {
  const icons = {
    grid: '▦', monitor: '▣', play: '▶', stop: '■', settings: '⚙',
    audio: '◖', video: '▰', crop: '⌗', chevron: '⌄', check: '✓',
    more: '•••', external: '↗', lock: '▣', warning: '△',
  }
  return <span className={`icon icon-${name}`} aria-hidden="true">{icons[name] || '•'}</span>
}

function App() {
  const screenVideoRef = useRef(null)
  const screenCanvasRef = useRef(null)
  const chatChannelRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const screenStreamRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const cropStageRef = useRef(null)
  const cropSelectionRef = useRef(null)
  const [screenStream, setScreenStream] = useState(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [source, setSource] = useState('Pantalla completa')
  const [isCropping, setIsCropping] = useState(false)
  const [cropRect, setCropRect] = useState({ x: 20, y: 15, width: 60, height: 70 })
  const [savedCropRect, setSavedCropRect] = useState(null)
  const [isSelectingCrop, setIsSelectingCrop] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [audio, setAudio] = useState(true)
  const [fps, setFps] = useState('30 FPS')
  const [message, setMessage] = useState('Listo para transmitir')
  const [viewerCount, setViewerCount] = useState(0)
  const [turn, setTurn] = useState('Camila')
  const [dice, setDice] = useState(6)
  const [gameMessage, setGameMessage] = useState('Camila está jugando')
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: 'Sofia_Gamer', avatar: 'S', color: 'blue-bg', text: '¡Vamos Camila! 🎲', time: 'Ahora' },
    { id: 2, user: 'Mateo_X', avatar: 'M', color: 'yellow-bg', text: 'Esta partida está buenísima 🔥', time: 'Ahora' },
    { id: 3, user: 'Lucia_Perez', avatar: 'L', color: 'green-bg', text: '¿Quién ganará el torneo?', time: 'Ahora' },
  ])
  const [activeCell, setActiveCell] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [orders, setOrders] = useState({})

  const isLive = Boolean(screenStream || cameraStream)

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined
    const channel = new BroadcastChannel('ludo-live-chat-DANCE-204')
    chatChannelRef.current = channel
    channel.onmessage = (event) => {
      if (event.data?.type === 'chat-message') {
        setChatMessages((messages) => [...messages, event.data.message])
      }
    }
    return () => {
      channel.close()
      chatChannelRef.current = null
    }
  }, [])

  const rollDice = () => {
    const value = Math.floor(Math.random() * 6) + 1
    setDice(value)
    setGameMessage(`${turn} sacó un ${value}`)
  }

  const changeTurn = () => {
    const next = turn === 'Camila' ? 'Sofía' : turn === 'Sofía' ? 'Mateo' : 'Camila'
    setTurn(next)
    setGameMessage(`${next} está jugando`)
  }

  const sendChatMessage = (event) => {
    event.preventDefault()
    const text = chatMessage.trim()
    if (!text) return
    const message = {
      id: Date.now(),
      user: 'Jorge_Diaz',
      avatar: 'J',
      color: 'purple-bg',
      text,
      time: 'Ahora',
    }
    setChatMessages((messages) => [...messages, message])
    chatChannelRef.current?.postMessage({ type: 'chat-message', message })
    setChatMessage('')
  }

  const sendReaction = (reaction) => {
    setChatMessage((current) => `${current}${reaction}`)
  }

  const openCellModal = (column, rowIndex, value) => {
    setActiveCell({ column, rowIndex, value })
    setQuantity(orders[`${column.name}-${rowIndex}`] || 1)
  }

  const closeCellModal = () => {
    setActiveCell(null)
    setQuantity(1)
  }

  const updateQuantity = (nextValue) => {
    const parsed = Number(nextValue)
    setQuantity(Number.isFinite(parsed) ? Math.min(99, Math.max(1, Math.floor(parsed))) : 1)
  }

  const confirmOrder = () => {
    const key = `${activeCell.column.name}-${activeCell.rowIndex}`
    setOrders((current) => ({ ...current, [key]: quantity }))
    setGameMessage(`Pedido de ${quantity} ficha${quantity === 1 ? '' : 's'} para ${activeCell.column.name}`)
    closeCellModal()
  }

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
    screenStreamRef.current = screenStream
    cameraStreamRef.current = cameraStream
  }, [screenStream, cameraStream])

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const stopScreen = () => {
    screenStream?.getTracks().forEach((track) => track.stop())
    setScreenStream(null)
    setSavedCropRect(null)
    setMessage(cameraStream ? 'Cámara activa · falta la pantalla' : 'Transmisión detenida')
  }

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setMessage(screenStream ? 'Pantalla activa · falta la cámara' : 'Transmisión detenida')
  }

  const startScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage('Tu navegador no admite captura de pantalla')
      return
    }
    try {
      const nextStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: Number.parseInt(fps, 10) || 30 }, audio,
      })
      const videoTrack = nextStream.getVideoTracks()[0]
      videoTrack.onended = stopScreen
      setScreenStream(nextStream)
      setViewerCount(1)
      setMessage(cameraStream ? 'Estudio completo · pantalla y cámara activas' : 'Pantalla activa · inicia también la cámara')
    } catch (error) {
      if (error.name !== 'NotAllowedError') setMessage('No se pudo iniciar la captura de pantalla')
    }
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Tu navegador no admite cámara')
      return
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio })
      const videoTrack = nextStream.getVideoTracks()[0]
      videoTrack.onended = stopCamera
      setCameraStream(nextStream)
      setMessage(screenStream ? 'Estudio completo · pantalla y cámara activas' : 'Cámara activa · inicia también la pantalla')
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMessage('Permiso de cámara rechazado: permite cámara y micrófono')
      } else if (error.name === 'NotFoundError') {
        setMessage('No se encontró una cámara disponible')
      } else setMessage('No se pudo iniciar la cámara')
    }
  }

  const startBoth = async () => {
    if (!screenStream) await startScreen()
    if (!cameraStream) await startCamera()
  }

  const handleSourceChange = (event) => {
    setSource(event.target.value)
    setMessage('Pulsa “Iniciar captura” para elegir una nueva fuente')
  }

  const updateCrop = (event) => {
    const selection = cropSelectionRef.current
    const stage = cropStageRef.current
    if (!selection || !stage) return
    const bounds = stage.getBoundingClientRect()
    const currentX = Math.min(Math.max(((event.clientX - bounds.left) / bounds.width) * 100, 0), 100)
    const currentY = Math.min(Math.max(((event.clientY - bounds.top) / bounds.height) * 100, 0), 100)
    const x = Math.min(selection.startX, currentX)
    const y = Math.min(selection.startY, currentY)
    setCropRect({
      x,
      y,
      width: Math.max(Math.abs(currentX - selection.startX), 8),
      height: Math.max(Math.abs(currentY - selection.startY), 8),
    })
  }

  const startCropSelection = (event) => {
    if (!isCropping || !screenStream) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    cropSelectionRef.current = {
      startX: ((event.clientX - bounds.left) / bounds.width) * 100,
      startY: ((event.clientY - bounds.top) / bounds.height) * 100,
    }
    setIsSelectingCrop(true)
  }

  const stopCropDrag = () => {
    cropSelectionRef.current = null
    setIsSelectingCrop(false)
  }

  const cropButtonAction = () => {
    if (isCropping && screenStream) {
      setSavedCropRect(cropRect)
      setIsCropping(false)
      setMessage('Área recortada aplicada')
      return
    }
    setSavedCropRect(null)
    setIsCropping(true)
  }
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
        const sourceX = crop ? video.videoWidth * crop.x / 100 : 0
        const sourceY = crop ? video.videoHeight * crop.y / 100 : 0
        const sourceWidth = crop ? video.videoWidth * crop.width / 100 : video.videoWidth
        const sourceHeight = crop ? video.videoHeight * crop.height / 100 : video.videoHeight
        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
      }
      frameId = requestAnimationFrame(renderScreen)
    }
    frameId = requestAnimationFrame(renderScreen)
    return () => cancelAnimationFrame(frameId)
  }, [savedCropRect])

  return (
    <main className="ludo-app">
      <header className="ludo-header"><div className="ludo-brand"><span className="crown">♛</span><div><b>LUDO <em>KING</em></b><small>LIVE ARENA</small></div></div><div className="room-title"><span className="live-dot" /> SALA EN VIVO <strong>#DANCE-204</strong></div><div className="header-actions"><span className={`status-pill ${isLive ? 'is-live' : ''}`}><i /> {isLive ? 'TRANSMISIÓN ACTIVA' : 'LISTO PARA JUGAR'}</span><button className="ghost-btn"><Icon name="settings" /></button></div></header>
      <div className="ludo-layout">
        <section className="arena-column">
          <div className="hero-banner"><img src="/assets/ludo-1.png" alt="Ludo King Dance Season" /><div><p>EVENTO ESPECIAL</p><h1>Ludo King<br /><span>Dance Season</span></h1><button className="gold-btn">Ver reglas <Icon name="external" /></button></div></div>
        
          <div className="token-table-card"><div className="token-table-head"><div><span className="eyebrow">TABLERO DE FICHAS</span><h2>Elige una casilla para pedir fichas</h2></div><span className="table-hint">Haz clic en cualquier celda</span></div><div className="token-table">{ludoColumns.map((column) => <div className={`token-column ${column.className}`} key={column.name}><div className="token-column-title">{column.name}</div>{column.values.map((value, rowIndex) => { const key = `${column.name}-${rowIndex}`; return <button className={`token-cell ${orders[key] ? 'has-order' : ''}`} key={key} onClick={() => openCellModal(column, rowIndex, value)}><span>{value}</span>{orders[key] && <b>x{orders[key]}</b>}</button> })}</div>)}</div></div>
          <div className="stream-card"><div className="stream-card-head"><div><span className="eyebrow">ESTUDIO DE TRANSMISIÓN</span><h2>Vista del presentador</h2></div><span className="stream-note">{message}</span></div><div className="stream-preview"><div className="source-preview game-screen"><span className="source-badge"><Icon name="monitor" /> PANTALLA</span>{!screenStream && <div className="empty-preview"><div className="empty-icon"><Icon name="monitor" /></div><h2>Tu pantalla aparecerá aquí</h2><p>Inicia la pantalla para transmitir el tablero.</p></div>}<video ref={screenVideoRef} className="screen-source-video" muted playsInline /><canvas ref={screenCanvasRef} className="screen-canvas" />{isCropping && screenStream && <div className="crop-frame" style={{ left: `${cropRect.x}%`, top: `${cropRect.y}%`, width: `${cropRect.width}%`, height: `${cropRect.height}%` }}><label>SELECCIÓN</label></div>}</div><div className="source-preview game-camera"><span className="source-badge"><Icon name="video" /> CÁMARA</span>{!cameraStream && <div className="empty-preview"><div className="empty-icon"><Icon name="video" /></div><h2>Cámara lista</h2><p>Activa tu cámara para aparecer en la arena.</p></div>}<video ref={cameraVideoRef} className="camera-video" muted playsInline /></div></div><div className="stream-controls"><button className="primary-action" onClick={startBoth}><Icon name="play" /> Activar directo</button><button className="secondary-action" onClick={screenStream ? stopScreen : startScreen}>{screenStream ? 'Detener pantalla' : 'Compartir pantalla'}</button><button className="secondary-action" onClick={cameraStream ? stopCamera : startCamera}>{cameraStream ? 'Detener cámara' : 'Activar cámara'}</button><button className="crop-control" onClick={cropButtonAction}><Icon name="crop" /> {isCropping ? 'Aplicar recorte' : 'Recortar pantalla'}</button></div></div>
        </section>
        <aside className="ludo-sidebar"><div className="art-card"><img src="/assets/ludo-2.png" alt="Ludo King" /><div><b>EL REY HA LLEGADO</b><span>Juega. Baila. Domina.</span></div></div><div className="side-card"><div className="side-head"><h3>Jugadores</h3><span>4 / 4 <i className="online-dot" /></span></div><div className="player-row"><span className="player-avatar red-bg">C</span><div><b>Camila_Live</b><small>Turno actual</small></div><strong>1,250</strong></div><div className="player-row"><span className="player-avatar blue-bg">S</span><div><b>Sofia_Gamer</b><small>Conectada</small></div><strong>980</strong></div><div className="player-row"><span className="player-avatar yellow-bg">M</span><div><b>Mateo_X</b><small>Conectado</small></div><strong>760</strong></div><div className="player-row"><span className="player-avatar green-bg">L</span><div><b>Lucia_Perez</b><small>Conectada</small></div><strong>640</strong></div></div><div className="side-card activity"><div className="side-head"><h3>Actividad en vivo</h3><span className="live-label">● EN VIVO</span></div><p>🎲 {gameMessage}</p><p>🎉 Camila avanzó 6 casillas</p><p>✨ ¡Sofía capturó una ficha!</p></div><div className="side-card chat-card"><div className="side-head"><h3>Chat en vivo</h3><span className="online-count"><i className="online-dot" /> 24 conectados</span></div><div className="chat-messages">{chatMessages.map((message) => <div className="chat-message" key={message.id}><span className={`player-avatar ${message.color}`}>{message.avatar}</span><div><div className="chat-line"><b>{message.user}</b><small>{message.time}</small></div><p>{message.text}</p></div></div>)}</div><div className="reaction-row"><button type="button" onClick={() => sendReaction(' 👏')}>👏</button><button type="button" onClick={() => sendReaction(' 🔥')}>🔥</button><button type="button" onClick={() => sendReaction(' 🎲')}>🎲</button><button type="button" onClick={() => sendReaction(' ❤️')}>❤️</button></div><form className="chat-form" onSubmit={sendChatMessage}><input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Escribe un comentario..." aria-label="Escribe un comentario" maxLength="180" /><button type="submit" aria-label="Enviar comentario"><Icon name="external" /></button></form></div><button className="next-turn" onClick={changeTurn}>Siguiente turno <Icon name="chevron" /></button></aside>
      </div>
      {activeCell && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCellModal() }}><section className="token-modal" role="dialog" aria-modal="true" aria-labelledby="token-modal-title"><button className="modal-close" onClick={closeCellModal} aria-label="Cerrar modal">×</button><span className={`modal-color-dot ${activeCell.column.className}`} /><h2 id="token-modal-title">{activeCell.column.name}</h2><p className="modal-subtitle">{activeCell.value} · fila {activeCell.rowIndex + 1}</p><div className="quantity-control"><button onClick={() => updateQuantity(quantity - 1)} aria-label="Disminuir cantidad">−</button><input type="number" min="1" max="99" value={quantity} onChange={(event) => updateQuantity(event.target.value)} aria-label="Cantidad de fichas" /><button onClick={() => updateQuantity(quantity + 1)} aria-label="Aumentar cantidad">+</button></div><div className="modal-actions"><button className="modal-cancel" onClick={closeCellModal}>Cancelar</button><button className="modal-confirm" onClick={confirmOrder}>Pedir</button></div></section></div>}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
