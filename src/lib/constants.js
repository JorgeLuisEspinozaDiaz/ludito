export const COLORS = [
  { name: 'MORADO', className: 'purple-column' },
  { name: 'AMARILLO', className: 'yellow-column' },
  { name: 'CELESTE', className: 'cyan-column' },
  { name: 'ROJO', className: 'red-column' },
  { name: 'VERDE', className: 'green-column' },
  { name: 'NARANJA', className: 'orange-column' },
]

export const DEFAULT_ROOM = 'DANCE-204'
export const DEMO_ACCESS_CODE = '1234'
export const DEMO_ADMIN_PIN = '9999'

export function emptyRoomState(id = DEFAULT_ROOM) {
  return {
    id,
    round: 1,
    status: 'open',
    winningColor: null,
    streamActive: false,
    micMuted: true,
    cameraActive: false,
    screenActive: false,
    colors: COLORS.map((c) => c.name),
    participants: [],
    ordersByColor: Object.fromEntries(COLORS.map((c) => [c.name, []])),
    totals: Object.fromEntries(COLORS.map((c) => [c.name, 0])),
    chat: [],
    activity: [],
    viewerCount: 0,
    invites: [],
  }
}
