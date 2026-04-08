import { useEffect, useRef } from 'react'
import type { ThreadUser } from '../api/types'

interface Props {
  user: ThreadUser
  onClose: () => void
}

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
      {user.bio && <p>{user.bio}</p>}
    </div>
  )
}
