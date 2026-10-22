export function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  for (const [n, unit] of [[86400, 'd'], [3600, 'h'], [60, 'm']] as const)
    if (s >= n) return `${Math.floor(s / n)}${unit} ago`
  return 'just now'
}
