import { useState } from 'react'
import { Icon } from './Icon'

export function JoinGate({
  title,
  subtitle,
  nameLabel = 'Tu nombre',
  codeLabel = 'Código de sala',
  codeHint,
  submitLabel = 'Entrar',
  defaultName = '',
  defaultCode = '',
  pinOnly = false,
  error,
  onSubmit,
}) {
  const [name, setName] = useState(defaultName)
  const [code, setCode] = useState(defaultCode)

  return (
    <div className="join-gate">
      <form
        className="join-card"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit?.({
            name: pinOnly ? 'jugador' : name.trim(),
            code: code.trim(),
          })
        }}
      >
        <div className="join-logo"><Icon name="lock" /></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {!pinOnly && (
          <label>
            <span>{nameLabel}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Camila"
              maxLength={24}
              autoFocus
              required
            />
          </label>
        )}
        <label>
          <span>{codeLabel}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={codeHint || 'PIN'}
            maxLength={6}
            inputMode="numeric"
            autoFocus={pinOnly}
            required
          />
        </label>
        {error && <p className="join-error">{error}</p>}
        <button type="submit" className="join-submit">{submitLabel}</button>
      </form>
    </div>
  )
}
