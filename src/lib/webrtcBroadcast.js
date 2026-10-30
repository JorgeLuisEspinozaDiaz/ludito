import { getIceServers } from './iceConfig'

const ICE = () => ({ iceServers: getIceServers() })

/** Admin: publica media a cada viewer */
export function createBroadcaster({ sendSignal, getLocalStream }) {
  const peers = new Map()

  async function connectViewer(viewerId) {
    if (peers.has(viewerId)) {
      peers.get(viewerId).close()
      peers.delete(viewerId)
    }

    const stream = getLocalStream?.()
    if (!stream || stream.getTracks().length === 0) return

    const pc = new RTCPeerConnection(ICE())
    peers.set(viewerId, pc)

    const roles = {}
    for (const track of stream.getTracks()) {
      const role = track._luditoRole || (track.kind === 'audio' ? 'audio' : 'screen')
      roles[track.id] = role
      pc.addTrack(track, stream)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(viewerId, { kind: 'candidate', candidate: event.candidate })
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendSignal(viewerId, { kind: 'offer', sdp: pc.localDescription, roles })
  }

  async function handleSignal(from, signal) {
    const pc = peers.get(from)
    if (!pc || !signal) return
    if (signal.kind === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(signal.sdp)
      }
    } else if (signal.kind === 'candidate' && signal.candidate) {
      try {
        await pc.addIceCandidate(signal.candidate)
      } catch {
        /* ignore */
      }
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
    for (const pc of peers.values()) {
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
    for (const pc of peers.values()) pc.close()
    peers.clear()
  }

  return { connectViewer, handleSignal, republishAll, replaceTrackByRole, knownViewers, close }
}

/** Viewer: recibe pantalla + cámara + audio */
export function createViewer({ sendSignal, onStreams }) {
  let pc = null
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
    // If only camera (no screen), play camera as main with audio
    if (!remote.screen && remote.camera) playback.unshift(remote.camera)

    onStreams?.({
      screen: remote.screen ? new MediaStream([remote.screen]) : null,
      camera: remote.camera ? new MediaStream([remote.camera]) : null,
      playback: playback.length ? new MediaStream(playback) : null,
      combined: all.length ? new MediaStream(all) : null,
      hasVideo: Boolean(remote.screen || remote.camera),
    })
  }

  async function handleSignal(from, signal) {
    if (!signal) return

    if (signal.kind === 'offer') {
      if (pc) pc.close()
      remote.screen = null
      remote.camera = null
      remote.audio = null

      pc = new RTCPeerConnection(ICE())
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
        if (event.candidate) {
          sendSignal(from, { kind: 'candidate', candidate: event.candidate })
        }
      }

      await pc.setRemoteDescription(signal.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal(from, { kind: 'answer', sdp: pc.localDescription })
      return
    }

    if (!pc) return
    if (signal.kind === 'candidate' && signal.candidate) {
      try {
        await pc.addIceCandidate(signal.candidate)
      } catch {
        /* ignore */
      }
    }
  }

  function close() {
    pc?.close()
    pc = null
    remote.screen = null
    remote.camera = null
    remote.audio = null
    emit()
  }

  return { handleSignal, close }
}
