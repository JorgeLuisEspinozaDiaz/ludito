import { COLORS } from '../lib/constants'

const COLOR_HEX = {
  MORADO: '#9656c5',
  AMARILLO: '#caa52d',
  CELESTE: '#318fb2',
  ROJO: '#bd4d59',
  VERDE: '#3baf61',
  NARANJA: '#c47b2d',
}

export function WinnerCelebration({ color, won, detail, onClose }) {
  if (!color) return null
  const meta = COLORS.find((item) => item.name === color)
  const hex = COLOR_HEX[color] || '#ffca55'

  return (
    <div className="winner-overlay" role="dialog" aria-modal="true" aria-label={`Ganó ${color}`}>
      <div className="winner-burst" style={{ '--win': hex }} aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} style={{ '--i': index }} />
        ))}
      </div>
      <div className={`winner-card ${meta?.className || ''}`} style={{ '--win': hex }}>
        <p className="winner-kicker">COLOR GANADOR</p>
        <h2 className="winner-title">{color}</h2>
        <div className="winner-orb" aria-hidden="true" />
        {typeof won === 'boolean' && (
          <p className={`winner-personal ${won ? 'won' : 'lost'}`}>
            {won ? '¡Felicitaciones, ganaste!' : 'Esta ronda no fue tuya'}
          </p>
        )}
        {detail && <p className="winner-detail">{detail}</p>}
        <button type="button" className="winner-close" onClick={onClose}>
          Continuar
        </button>
      </div>
    </div>
  )
}
