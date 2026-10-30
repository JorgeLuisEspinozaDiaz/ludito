import { COLORS } from '../lib/constants'

export function TokenBoard({
  ordersByColor = {},
  totals = {},
  canOrder,
  showBuyButtons = true,
  isAdmin,
  status,
  onSelectColor,
  onDeclareWinner,
  onOpenHistory,
}) {
  return (
    <div className="token-table-card">
      <div className="token-table-head">
        <div>
          <span className="eyebrow">TABLERO DE FICHAS</span>
          <h2>Pedidos en tiempo real</h2>
        </div>
        <div className="token-table-actions">
          <span className="table-hint">
            {status === 'open' ? 'Compras abiertas' : status === 'closed' ? 'Compras cerradas' : 'Resultado publicado'}
          </span>
          <button type="button" className="ghost-btn view-orders-btn" onClick={onOpenHistory}>
            Ver compras
          </button>
        </div>
      </div>
      <div className="token-table live-orders-table">
        {COLORS.map((column) => {
          const orders = ordersByColor[column.name] || []
          const total = totals[column.name] || 0
          return (
            <div className={`token-column ${column.className}`} key={column.name}>
              <button
                type="button"
                className="token-column-title winner-trigger"
                disabled={!isAdmin}
                title={isAdmin ? `Declarar ${column.name} ganador` : column.name}
                onClick={() => isAdmin && onDeclareWinner?.(column.name)}
              >
                {column.name}
                <small>x{total}</small>
              </button>
              <div className="token-order-list">
                {orders.length === 0 && (
                  <div className="token-empty">Sin pedidos</div>
                )}
                {orders.map((order) => (
                  <div className="token-order-row" key={order.id}>
                    <span>{order.name}</span>
                    <b>x{order.quantity}</b>
                  </div>
                ))}
              </div>
              {canOrder && showBuyButtons && (
                <button
                  type="button"
                  className="token-buy-btn"
                  onClick={() => onSelectColor?.(column)}
                >
                  Pedir
                </button>
              )}
            </div>
          )
        })}
      </div>
      {isAdmin && (
        <p className="admin-winner-hint">Como admin, haz clic en el nombre del color para declarar ganador.</p>
      )}
    </div>
  )
}
