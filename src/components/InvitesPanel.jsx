import { useState } from 'react'

export function InvitesPanel({ invites = [], liveLink, onCreate, onDelete }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [copied, setCopied] = useState('')

  const inviteUrl = (invite) => `${liveLink}/p/${invite.pin}`

  const copyInvite = async (invite) => {
    const url = inviteUrl(invite)
    const text = `${invite.name}, entra directo al vivo con este link:\n${url}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(invite.pin)
      window.setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('error')
    }
  }

  return (
    <div className="side-card invites-card">
      <div className="side-head">
        <h3>Usuarios y PIN</h3>
        <span>{invites.length} creados</span>
      </div>
      <p className="invites-help">
        Al crear un usuario se genera un link personal. Al abrirlo entra directo al vivo (sin pedir nombre).
      </p>
      <form
        className="invite-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onCreate?.({ name: name.trim(), pin: pin.trim() })
          setName('')
          setPin('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (ej. Jorge)"
          maxLength={24}
          required
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="PIN (vacío = auto)"
          inputMode="numeric"
          maxLength={6}
        />
        <button type="submit" className="primary-action">Crear</button>
      </form>
      <div className="invite-list">
        {invites.length === 0 && <p className="side-empty">Aún no hay usuarios. Crea el primero.</p>}
        {invites.map((invite) => (
          <div className="invite-row" key={invite.id || invite.pin}>
            <div>
              <b>{invite.name}</b>
              <small>PIN {invite.pin}</small>
              <code className="invite-link-preview">{inviteUrl(invite)}</code>
            </div>
            <div className="invite-row-actions">
              <button type="button" className="ghost-btn" onClick={() => copyInvite(invite)}>
                {copied === invite.pin ? 'Copiado' : 'Copiar link'}
              </button>
              <button type="button" className="ghost-btn danger-btn" onClick={() => onDelete?.(invite.pin)}>
                X
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
