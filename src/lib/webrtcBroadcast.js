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

/** Admin: publica media a cada viewer */
export function createBroadcaster({ sendSignal, getLocalStream }) {
  const peers = new Map()

  async function connectViewer(viewerId) {
    const existing = peers.get(viewerId)
    if (existing) {
      existing.pc.close()
      peers.delete(viewerId)
    }

    const stream = getLocalStream?.()
    if (!stream || stream.getTracks().length === 0) return

    const pc = new RTCPeerConnection(iceConfig())
    const pending = []
    peers.set(viewerId, { pc, pending })

    const roles = {}
    for (const track of stream.getTracks()) {
      const role = track._luditoRole || (track.kind === 'audio' ? 'audio' : 'screen')
      roles[track.id] = role
      try {
        track.contentHint = role === 'camera' ? 'motion' : track.kind === 'video' ? 'detail' : track.contentHint
      } catch {
        /* ignore */
      }
      pc.addTrack(track, stream)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(viewerId, { kind: 'candidate', candidate: event.candidate.toJSON?.() || event.candidate })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce()
        } catch {
          /* ignore */
        }
      }
    }

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    })
    await pc.setLocalDescription(offer)
    sendSignal(viewerId, {
      kind: 'offer',
      sdp: pc.localDescription,
      roles,
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

  async function republishAll(viewerIds = [...peers.keys()]) {
    for (const viewerId of viewerIds) {
      await connectViewer(viewerId)
    }
  }

  /** Cambia un track al aire sin recrear la conexión (p. ej. otra ventana/pantalla). */
  async function replaceTrackByRole(role, nextTrack) {
    if (nextTrack) nextTrack._luditoRole = role
    const tasks = []
    for (const { pc } of peers.values()) {
      for (const sender of pc.getSenders()) {
        const current = sender.track
        if (!current) continue
        const currentRole = current._luditoRole || (current.kind === 'audio' ? 'audio' : null)
        if (currentRole === role) {
          tasks.push(sender.replaceTrack(nextTrack))
        }
      }
    }
    await Promise.allSettled(tasks)
    return tasks.length > 0
  }

  function knownViewers() {
    return [...peers.keys()]
  }

  function close() {
    for (const { pc } of peers.values()) pc.close()
    peers.clear()
  }

  return { connectViewer, handleSignal, republishAll, replaceTrackByRole, knownViewers, close }
}

/** Viewer: recibe pantalla + cámara + audio */
export function createViewer({ sendSignal, onStreams, onConnectionState }) {
  let pc = null
  let pending = []
  let adminId = null
  const remote = {
    screen: null,
    camera: null,
    audio: null,
  }

  function emit() {
    const all = []
    const playback = []
    if (remote.screen) {
      all.push(remote.screen)
      playback.push(remote.screen)
    }
    if (remote.camera) all.push(remote.camera)
    if (remote.audio) {
      all.push(remote.audio)
      playback.push(remote.audio)
    }
    if (!remote.screen && remote.camera) playback.unshift(remote.camera)

    onStreams?.({
      screen: remote.screen ? new MediaStream([remote.screen]) : null,
      camera: remote.camera ? new MediaStream([remote.camera]) : null,
      playback: playback.length ? new MediaStream(playback) : null,
      combined: all.length ? new MediaStream(all) : null,
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
      if (pc) {
        pc.close()
        pc = null
      }
      pending = []
      remote.screen = null
      remote.camera = null
      remote.audio = null

      pc = new RTCPeerConnection(iceConfig())
      const roles = signal.roles || {}
      let videoCount = 0

      pc.ontrack = (event) => {
        const track = event.track
        let role = roles[track.id]
        if (!role) {
          if (track.kind === 'audio') role = 'audio'
          else {
            videoCount += 1
            role = videoCount === 1 ? 'screen' : 'camera'
          }
        }

        if (role === 'camera') remote.camera = track
        else if (role === 'audio') remote.audio = track
        else remote.screen = track

        try {
          track.enabled = true
        } catch {
          /* ignore */
        }

        track.onunmute = () => emit()
        track.onmute = () => emit()
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
          sendSignal(adminId, { kind: 'candidate', candidate: event.candidate.toJSON?.() || event.candidate })
        }
      }

      pc.onconnectionstatechange = () => {
        onConnectionState?.(pc.connectionState)
        emit()
        if (pc.connectionState === 'failed') {
          try {
            pc.restartIce()
          } catch {
            /* ignore */
          }
        }
      }

      pc.oniceconnectionstatechange = () => {
        onConnectionState?.(pc.iceConnectionState)
        emit()
      }

      await pc.setRemoteDescription(signal.sdp)
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
    pc?.close()
    pc = null
    pending = []
    adminId = null
    remote.screen = null
    remote.camera = null
    remote.audio = null
    emit()
  }

  return { handleSignal, close }
}
