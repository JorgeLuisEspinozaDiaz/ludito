import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { COLORS } from '../lib/constants'
import { parseOrderCommand } from '../lib/parseOrderCommand'

export function ChatPanel({
  messages = [],
  onlineCount = 0,
  canOrder = false,
  showColorShortcuts = true,
  onSend,
  onReact,
  onOrder,
  onPickColor,
}) {
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages])

  const submit = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return

    if (canOrder) {
      const parsed = parseOrderCommand(value)
      if (parsed) {
        onOrder?.(parsed.color, parsed.quantity)
        setText('')
        return
      }
    }

    onSend?.(value)
    setText('')
  }

  return (
    <div className="side-card chat-card">
      <div className="side-head">
        <h3>Chat en vivo</h3>
        <span className="online-count"><i className="online-dot" /> {onlineCount} conectados</span>
      </div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">Sé el primero en escribir…</p>}
        {messages.map((message) => (
          <div className="chat-message" key={message.id}>
            <span className={`player-avatar ${message.color}`}>{message.avatar}</span>
            <div>
              <div className="chat-line">
                <b>{message.user}</b>
                <small>{message.time}</small>
              </div>
              <p>{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      {canOrder && showColorShortcuts && (
        <div className="chat-color-row">
          {COLORS.map((column) => (
            <button
              type="button"
              key={column.name}
              className={`chat-color-chip ${column.className}`}
              title={`Pedir ${column.name}`}
              onClick={() => onPickColor?.(column)}
            >
              {column.name.slice(0, 3)}
            </button>
          ))}
        </div>
      )}
      <div className="reaction-row">
        {['👏', '🔥', '🎲', '❤️'].map((emoji) => (
          <button type="button" key={emoji} onClick={() => onReact?.(emoji)}>{emoji}</button>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canOrder ? 'Chat o pide: rojo 5' : 'Escribe un comentario...'}
          maxLength={180}
          aria-label="Escribe un comentario"
        />
        <button type="submit" aria-label="Enviar comentario"><Icon name="external" /></button>
      </form>
    </div>
  )
}
