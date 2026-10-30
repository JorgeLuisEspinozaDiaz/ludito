import { getRtcConfiguration } from './iceConfig'

function iceConfig() {
  return getRtcConfiguration()
}

async function addIceSafe(pc, candidate, pending) {
  if (!candidate) return
  if (!pc.remoteDescription) {
    pending.push(candidate)
    return
  }
  try {
    await pc.addIceCandidate(candidate)
  } catch {
    /* ignore obsolete candidates */
  }
}

async function flushIce(pc, pending) {
  const batch = pending.splice(0, pending.length)
  for (const candidate of batch) {
    try {
      await pc.addIceCandidate(candidate)
    } catch {
      /* ignore */
    }
  }
}

function trackRole(track) {
  if (!track) return null
  if (track._luditoRole) return track._luditoRole
  return track.kind === 'audio' ? 'audio' : null
}

function isPcHealthy(pc) {
  if (!pc) return false
  const c = pc.connectionState
  const i = pc.iceConnectionState
  return (
    c === 'connected' ||
    c === 'connecting' ||
    i === 'connected' ||
    i === 'completed' ||
    i === 'checking'
  )
}

/** Actualiza tracks en PC existente. false = hace falta reconectar (roles nuevos). */
async function syncSenders(pc, stream) {
  const desired = {}
  for (const track of stream.getTracks()) {
    const role = trackRole(track) || (track.kind === 'audio' ? 'audio' : 'screen')
    track._luditoRole = role
    desired[role] = track
  }

  const covered = new Set()
  for (const sender of pc.getSenders()) {
    const current = sender.track
    if (!current) continue
    const role = trackRole(current)
    if (!role || !desired[role]) continue
    if (sender.track !== desired[role]) {
      await sender.replaceTrack(desired[role])
    }
    covered.add(role)
  }

  return Object.keys(desired).every((role) => covered.has(role))
}

/** Admin: publica media a cada viewer (sin recrear la PC a cada clic) */
export function createBroadcaster({ sendSignal, getLocalStream }) {
  const peers = new Map()
  const locks = new Map()

  async function withLock(viewerId, fn) {
    const prev = locks.get(viewerId) || Promise.resolve()
    let release
    const gate = new Promise((resolve) => { release = resolve })
    locks.set(viewerId, prev.then(() => gate).catch(() => gate))
    try {
      await prev.catch(() => {})
      return await fn()
    } finally {
      release()
    }
  }

  async function connectViewer(viewerId, { force = false } = {}) {
    return withLock(viewerId, async () => {
      const stream = getLocalStream?.()
      if (!stream || stream.getTracks().length === 0) return false

      const existing = peers.get(viewerId)
      if (existing && !force && isPcHealthy(existing.pc)) {
        try {
          const synced = await syncSenders(existing.pc, stream)
          if (synced) return true
        } catch {
          /* reconnect below */
        }
      }

      if (existing) {
        try { existing.pc.close() } catch { /* ignore */ }
        peers.delete(viewerId)
      }

      const pc = new RTCPeerConnection(iceConfig())
      const pending = []
      peers.set(viewerId, { pc, pending })

      const roles = {}
      const roleOrder = []
      for (const track of stream.getTracks()) {
        const role = trackRole(track) || (track.kind === 'audio' ? 'audio' : 'screen')
        track._luditoRole = role
        roles[track.id] = role
        roleOrder.push(role)
        try {
          track.contentHint = role === 'camera' ? 'motion' : track.kind === 'video' ? 'detail' : track.contentHint
        } catch {
          /* ignore */
        }
        // Un MediaStream por track: más fiable en móviles
        pc.addTrack(track, new MediaStream([track]))
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(viewerId, {
            kind: 'candidate',
            candidate: event.candidate.toJSON?.() || event.candidate,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          try { pc.restartIce() } catch { /* ignore */ }
        }
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      })
      await pc.setLocalDescription(offer)

      const rolesByMid = {}
      for (const tr of pc.getTransceivers()) {
        const track = tr.sender?.track
        if (tr.mid && track) rolesByMid[tr.mid] = trackRole(track) || roles[track.id]
      }

      sendSignal(viewerId, {
        kind: 'offer',
        sdp: pc.localDescription,
        roles,
        rolesByMid,
        roleOrder,
      })
      return true
    })
  }

  async function handleSignal(from, signal) {
    const entry = peers.get(from)
    if (!entry || !signal) return
    const { pc, pending } = entry

    if (signal.kind === 'answer') {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(signal.sdp)
          await flushIce(pc, pending)
        }
      } catch {
        /* ignore glare */
      }
      return
    }

    if (signal.kind === 'candidate' && signal.candidate) {
      await addIceSafe(pc, signal.candidate, pending)
    }
  }

  async function republishAll(viewerIds = [...peers.keys()], { force = false } = {}) {
    const ids = [...new Set(viewerIds.length ? viewerIds : [...peers.keys()])]
    for (const viewerId of ids) {
      await connectViewer(viewerId, { force })
    }
  }

  async function replaceTrackByRole(role, nextTrack) {
    if (nextTrack) nextTrack._luditoRole = role
    const tasks = []
    for (const { pc } of peers.values()) {
      for (const sender of pc.getSenders()) {
        const current = sender.track
        if (!current) continue
        if (trackRole(current) === role) {
          tasks.push(sender.replaceTrack(nextTrack))
        }
      }
    }
    await Promise.allSettled(tasks)
    return tasks.length > 0
  }

  function setAudioEnabled(enabled) {
    for (const { pc } of peers.values()) {
      for (const sender of pc.getSenders()) {
        const track = sender.track
        if (track && (trackRole(track) === 'audio' || track.kind === 'audio')) {
          track.enabled = Boolean(enabled)
        }
      }
    }
  }

  function knownViewers() {
    return [...peers.keys()]
  }

  function close() {
    for (const { pc } of peers.values()) {
      try { pc.close() } catch { /* ignore */ }
    }
    peers.clear()
    locks.clear()
  }

  return {
    connectViewer,
    handleSignal,
    republishAll,
    replaceTrackByRole,
    setAudioEnabled,
    knownViewers,
    close,
  }
}

function tracksKey(stream) {
  if (!stream) return ''
  return stream.getTracks().map((t) => t.id).join(',')
}

/** Viewer: SOLO recibe (sin micrófono ni cámara local) */
export function createViewer({ sendSignal, onStreams, onConnectionState }) {
  let pc = null
  let pending = []
  let adminId = null
  let offerSeq = 0
  const remote = {
    screen: null,
    camera: null,
    audio: null,
  }
  let screenMs = null
  let cameraMs = null
  let playbackMs = null

  function ensureStream(current, tracks) {
    const nextTracks = tracks.filter(Boolean)
    if (!nextTracks.length) return null
    if (current && tracksKey(current) === nextTracks.map((t) => t.id).join(',')) return current
    return new MediaStream(nextTracks)
  }

  function emit() {
    screenMs = ensureStream(screenMs, remote.screen ? [remote.screen] : [])
    cameraMs = ensureStream(cameraMs, remote.camera ? [remote.camera] : [])
    const playTracks = []
    if (remote.screen) playTracks.push(remote.screen)
    else if (remote.camera) playTracks.push(remote.camera)
    if (remote.audio) playTracks.push(remote.audio)
    playbackMs = ensureStream(playbackMs, playTracks)

    onStreams?.({
      screen: screenMs,
      camera: cameraMs,
      playback: playbackMs,
      combined: playbackMs,
      hasVideo: Boolean(remote.screen || remote.camera),
      hasAudio: Boolean(remote.audio),
      connectionState: pc?.connectionState || 'new',
      iceState: pc?.iceConnectionState || 'new',
    })
  }

  async function handleSignal(from, signal) {
    if (!signal) return
    adminId = from || adminId

    if (signal.kind === 'offer') {
      const seq = ++offerSeq
      if (pc) {
        try { pc.close() } catch { /* ignore */ }
        pc = null
      }
      pending = []
      remote.screen = null
      remote.camera = null
      remote.audio = null
      screenMs = null
      cameraMs = null
      playbackMs = null

      pc = new RTCPeerConnection(iceConfig())
      const roles = signal.roles || {}
      const rolesByMid = signal.rolesByMid || {}
      const roleOrder = signal.roleOrder || []
      let videoCount = 0
      let orderIdx = 0

      pc.ontrack = (event) => {
        if (seq !== offerSeq) return
        const track = event.track
        const mid = event.transceiver?.mid
        let role = roles[track.id] || (mid && rolesByMid[mid]) || null
        if (!role) {
          if (track.kind === 'audio') role = 'audio'
          else {
            while (orderIdx < roleOrder.length && roleOrder[orderIdx] === 'audio') orderIdx += 1
            role = roleOrder[orderIdx] || (videoCount === 0 ? 'screen' : 'camera')
            orderIdx += 1
            videoCount += 1
          }
        }

        if (role === 'camera') remote.camera = track
        else if (role === 'audio') remote.audio = track
        else remote.screen = track

        try { track.enabled = true } catch { /* ignore */ }

        track.onunmute = () => emit()
        track.onended = () => {
          if (remote.screen === track) remote.screen = null
          if (remote.camera === track) remote.camera = null
          if (remote.audio === track) remote.audio = null
          emit()
        }
        emit()
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && adminId) {
          sendSignal(adminId, {
            kind: 'candidate',
            candidate: event.candidate.toJSON?.() || event.candidate,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        onConnectionState?.(pc.connectionState)
        emit()
        if (pc.connectionState === 'failed') {
          try { pc.restartIce() } catch { /* ignore */ }
        }
      }

      pc.oniceconnectionstatechange = () => {
        onConnectionState?.(pc.iceConnectionState)
        emit()
      }

      await pc.setRemoteDescription(signal.sdp)
      if (seq !== offerSeq) return
      await flushIce(pc, pending)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal(from, { kind: 'answer', sdp: pc.localDescription })
      emit()
      return
    }

    if (!pc) return
    if (signal.kind === 'candidate' && signal.candidate) {
      await addIceSafe(pc, signal.candidate, pending)
    }
  }

  function close() {
    try { pc?.close() } catch { /* ignore */ }
    pc = null
    pending = []
    adminId = null
    remote.screen = null
    remote.camera = null
    remote.audio = null
    screenMs = null
    cameraMs = null
    playbackMs = null
    emit()
  }

  return { handleSignal, close }
}
