import { useCallback, useState } from 'react'

export type StoredMode = 'sequence' | 'radio-only'

type Preferences = {
  lastMode: StoredMode | null
  lastStartedAt: string | null
  startCount: number
}

const STORAGE_KEY = 'morning-drive:preferences:v1'

const EMPTY: Preferences = {
  lastMode: null,
  lastStartedAt: null,
  startCount: 0,
}

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY

    const parsed = JSON.parse(raw) as Partial<Preferences>
    const lastMode = parsed.lastMode === 'sequence' || parsed.lastMode === 'radio-only'
      ? parsed.lastMode
      : null

    return {
      lastMode,
      lastStartedAt: typeof parsed.lastStartedAt === 'string' ? parsed.lastStartedAt : null,
      startCount: Number.isFinite(parsed.startCount) ? Math.max(0, Number(parsed.startCount)) : 0,
    }
  } catch {
    return EMPTY
  }
}

function persist(preferences: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Some embedded browsers disable storage. Morning Drive still works without memory.
  }
}

export default function useLocalPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences())

  const recordStart = useCallback((mode: StoredMode) => {
    setPreferences(current => {
      const next: Preferences = {
        lastMode: mode,
        lastStartedAt: new Date().toISOString(),
        startCount: current.startCount + 1,
      }
      persist(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setPreferences(EMPTY)
  }, [])

  return { preferences, recordStart, clearHistory }
}
