import { COLORS } from './constants'

const ALIASES = {
  MORADO: ['morado', 'lila', 'purple'],
  AMARILLO: ['amarillo', 'yellow'],
  CELESTE: ['celeste', 'azul', 'cyan'],
  ROJO: ['rojo', 'red'],
  VERDE: ['verde', 'green'],
  NARANJA: ['naranja', 'orange'],
}

export function parseOrderCommand(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const match = raw.match(/^([a-záéíóúüñ]+)\s*[x×:]?\s*(\d{1,2})$/i)
    || raw.match(/^(\d{1,2})\s*[x×]?\s*([a-záéíóúüñ]+)$/i)
  if (!match) return null

  const first = match[1]
  const second = match[2]
  const quantityToken = /^\d+$/.test(first) ? first : second
  const colorToken = /^\d+$/.test(first) ? second : first
  const quantity = Math.min(99, Math.max(1, Number(quantityToken)))
  const needle = colorToken.toLowerCase()

  for (const column of COLORS) {
    const aliases = ALIASES[column.name] || []
    if (column.name.toLowerCase() === needle || aliases.includes(needle)) {
      return { color: column.name, quantity, column }
    }
  }
  return null
}
