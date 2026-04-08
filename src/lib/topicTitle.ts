/**
 * Extract a short display title from a topic that may be raw markdown.
 * Looks for the first `# heading`, falls back to the first non-empty line,
 * then truncates.
 */
export function topicTitle(topic: string, maxLen = 80): string {
  const lines = topic.split('\n')

  // Try to find a markdown heading
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)/)
    if (match) {
      const title = match[1].replace(/[—–-]+\s*$/, '').trim()
      if (title.length > maxLen) return title.slice(0, maxLen - 3).trim() + '...'
      return title
    }
  }

  // Fallback: first non-empty line
  const first = lines.find(l => l.trim())?.trim() ?? topic.trim()
  if (first.length > maxLen) return first.slice(0, maxLen - 3).trim() + '...'
  return first
}
