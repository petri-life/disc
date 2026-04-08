const UNITS: [string, number][] = [
  ['y', 31536000],
  ['mo', 2592000],
  ['d', 86400],
  ['h', 3600],
  ['m', 60],
]

export function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  for (const [unit, secs] of UNITS) {
    const count = Math.floor(diff / secs)
    if (count >= 1) return `${count}${unit} ago`
  }
  return 'just now'
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remaining = secs % 60
  return remaining > 0 ? `${mins}m ${remaining}s` : `${mins}m`
}
