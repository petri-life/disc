import { useState, useEffect, useRef, useCallback } from 'react'
import { api, ApiError } from '../api/client'
import type { ConversationDetail, ProgressEntry } from '../api/types'

interface PollingState {
  conversation: ConversationDetail | null
  messages: ProgressEntry[]
  error: string | null
  loading: boolean
}

const POLL_INTERVAL = 3000
const TERMINAL = new Set(['done', 'converged', 'failed'])

export function usePolling(conversationId: string | undefined) {
  const [state, setState] = useState<PollingState>({
    conversation: null,
    messages: [],
    error: null,
    loading: true,
  })

  const afterRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const poll = useCallback(async () => {
    if (!conversationId) return

    try {
      const data = await api.getConversation(conversationId, afterRef.current)

      setState(prev => {
        const progress = data.progress ?? []
        const newMessages = progress.filter(
          p => !prev.messages.some(m => m.id === p.id)
        )
        const allMessages = [...prev.messages, ...newMessages]

        if (progress.length > 0) {
          afterRef.current = progress[progress.length - 1].id
        }

        return {
          conversation: data,
          messages: allMessages,
          error: null,
          loading: false,
        }
      })

      if (!TERMINAL.has(data.status)) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL)
      }
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to fetch conversation'
      setState(prev => ({ ...prev, error: message, loading: false }))
    }
  }, [conversationId])

  useEffect(() => {
    afterRef.current = 0
    setState({ conversation: null, messages: [], error: null, loading: true })

    if (conversationId) {
      poll()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [conversationId, poll])

  return state
}
