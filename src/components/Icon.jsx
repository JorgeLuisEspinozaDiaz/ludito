export function Icon({ name }) {
  const icons = {
    grid: '▦', monitor: '▣', play: '▶', stop: '■', settings: '⚙',
    audio: '◖', video: '▰', crop: '⌗', chevron: '⌄', check: '✓',
    more: '•••', external: '↗', lock: '▣', warning: '△', mic: '🎙', mute: '🔇',
    copy: '⧉',
  }
  return <span className={`icon icon-${name}`} aria-hidden="true">{icons[name] || '•'}</span>
}
