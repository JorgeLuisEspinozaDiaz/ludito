import { COLORS } from '../lib/constants'

export function OrdersHistoryModal({ open, ordersByColor = {}, round, onClose }) {
  if (!open) return null

  const rows = COLORS.flatMap((column) =>
    (ordersByColor[column.name] || []).map((order) => ({
      ...order,
      color: column.name,
      className: column.className,
    })),
  ).sort((a, b) => b.quantity - a.quantity)

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section className="token-modal orders-history-modal" role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Historial de compras</h2>
        <p className="modal-subtitle">Ronda {round} · todos los pedidos</p>
        {rows.length === 0 ? (
          <p className="side-empty">Todavía no hay compras en esta ronda.</p>
        ) : (
          <div className="orders-history-list">
            {rows.map((row) => (
              <div className="orders-history-row" key={row.id}>
                <span className={`orders-color-chip ${row.className}`}>{row.color}</span>
                <b>{row.name}</b>
                <strong>x{row.quantity}</strong>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="modal-confirm orders-history-close" onClick={onClose}>Cerrar</button>
      </section>
    </div>
  )
}
