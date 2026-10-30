import { Link } from 'react-router-dom'
import { DEFAULT_ROOM, DEMO_ACCESS_CODE, DEMO_ADMIN_PIN } from '../lib/constants'

export function HomePage() {
  const room = DEFAULT_ROOM
  return (
    <div className="join-gate home-page">
      <div className="join-card home-card">
        <div className="join-logo">♛</div>
        <h1>LUDO KING LIVE</h1>
        <p>El admin transmite. Los viewers compran colores y ven quién gana en tiempo real.</p>
        <div className="home-actions">
          <Link className="join-submit" to={`/admin/${room}`}>Soy administrador</Link>
          <Link className="join-secondary" to={`/live/${room}`}>Ver el en vivo</Link>
        </div>
        <div className="home-codes">
          <p><b>Sala demo:</b> #{room}</p>
          <p><b>PIN admin:</b> {DEMO_ADMIN_PIN}</p>
          <p><b>PIN viewer demo:</b> {DEMO_ACCESS_CODE} (o crea PINs en el panel admin)</p>
        </div>
      </div>
    </div>
  )
}
