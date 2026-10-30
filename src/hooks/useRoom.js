import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyRoomState } from '../lib/constants'
import { connectRoom } from '../lib/roomSocket'

export function useRoom({ roomId, role, enabled, credentials }) {
  const [state, setState] = useState(() => emptyRoomState(roomId))
  const [you, setYou] = useState(null)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const handlersRef = useRef({})

  const setHandlers = useCallback((handlers) => {
    handlersRef.current = handlers || {}
  }, [])

  useEffect(() => {
    if (!enabled || !credentials?.name || !credentials?.code) return undefined

    setError('')
    setConnected(false)
    setYou(null)

    const socket = connectRoom({
      room: roomId,
      role,
      name: credentials.name,
      code: credentials.code,
      onEvent: (event) => {
        if (event.type === 'joined') {
          setYou(event.you)
          setState(event.state)
          setConnected(true)
          setError('')
          handlersRef.current.onJoined?.(event)
          return
        }
        if (event.type === 'state') {
          setState(event.state)
          return
        }
        if (event.type === 'chat') {
          setState((current) => ({
            ...current,
            chat: [...current.chat, event.message].slice(-80),
          }))
          return
        }
        if (event.type === 'order_toast') {
          handlersRef.current.onOrderToast?.(event.order)
          return
        }
        if (event.type === 'winner') {
          handlersRef.current.onWinner?.(event)
          return
        }
        if (event.type === 'viewer_ready') {
          handlersRef.current.onViewerReady?.(event)
          return
        }
        if (event.type === 'signal') {
          handlersRef.current.onSignal?.(event)
          return
        }
        if (event.type === 'admin_left') {
          handlersRef.current.onAdminLeft?.()
          return
        }
        if (event.type === 'error') {
          setError(event.message || 'Error de sala')
          return
        }
        if (event.type === 'disconnected') {
          setConnected(false)
          setError('Desconectado del servidor')
        }
      },
    })

    socketRef.current = socket
    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [enabled, roomId, role, credentials?.name, credentials?.code])

  const send = useCallback((payload) => {
    socketRef.current?.send(payload)
  }, [])

  return { state, you, error, connected, send, setHandlers, setError }
}
