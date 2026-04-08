/**
 * Minimal markdown → HTML for comment bodies.
 * Handles: paragraphs, **bold**, *italic*, numbered lists, line breaks.
 * No XSS risk — we escape HTML first, then apply formatting.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

export function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text)
  const blocks = escaped.split(/\n{2,}/)

  return blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''

    // Check if block is a numbered list
    const lines = trimmed.split('\n')
    const isNumberedList = lines.every(l => /^\d+\.\s/.test(l.trim()) || !l.trim())
    if (isNumberedList) {
      const items = lines
        .filter(l => l.trim())
        .map(l => `<li>${inlineFormat(l.replace(/^\d+\.\s*/, ''))}</li>`)
        .join('')
      return `<ol>${items}</ol>`
    }

    // Check if block is a bullet list
    const isBulletList = lines.every(l => /^[-*]\s/.test(l.trim()) || !l.trim())
    if (isBulletList) {
      const items = lines
        .filter(l => l.trim())
        .map(l => `<li>${inlineFormat(l.replace(/^[-*]\s*/, ''))}</li>`)
        .join('')
      return `<ul>${items}</ul>`
    }

    // Regular paragraph — preserve single line breaks as <br>
    const formatted = lines.map(l => inlineFormat(l.trim())).join('<br/>')
    return `<p>${formatted}</p>`
  }).join('')
}
