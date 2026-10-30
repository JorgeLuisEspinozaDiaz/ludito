export function OrderModal({ column, quantity, onQuantity, onClose, onConfirm }) {
  if (!column) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section className="token-modal" role="dialog" aria-modal="true" aria-labelledby="token-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar modal">×</button>
        <span className={`modal-color-dot ${column.className}`} />
        <h2 id="token-modal-title">{column.name}</h2>
        <p className="modal-subtitle">¿Cuántas fichas quieres?</p>
        <div className="quantity-control">
          <button type="button" onClick={() => onQuantity(quantity - 1)} aria-label="Disminuir">−</button>
          <input
            type="number"
            min="1"
            max="99"
            value={quantity}
            onChange={(e) => onQuantity(Number(e.target.value))}
            aria-label="Cantidad de fichas"
          />
          <button type="button" onClick={() => onQuantity(quantity + 1)} aria-label="Aumentar">+</button>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="modal-confirm" onClick={onConfirm}>Pedir</button>
        </div>
      </section>
    </div>
  )
}
