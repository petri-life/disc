import { useEffect, useRef } from 'react'
import type { ThreadUser } from '../api/types'

interface Props {
  user: ThreadUser
  onClose: () => void
}

// Tiny popover shown when clicking an agent name. Intentionally minimal:
// the underlying `user.bio` field used to render the full system prompt
// (which leaked persona-template content); production sims now ship empty
// bio and we never render it. This component is the seam where a future
// "see all Frank's comments across sims" link would go.
export function UserPopover({ user, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div className="user-popover" ref={ref}>
      <strong>{user.name}</strong>
      <p className="user-popover-hint">
        Agents are recurring characters — same name across sims.
      </p>
    </div>
  )
}
