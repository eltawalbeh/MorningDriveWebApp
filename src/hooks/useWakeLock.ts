import { useCallback, useEffect, useRef, useState } from 'react'

type WakeLockSentinelLike = {
  release: () => Promise<void>
  released?: boolean
  addEventListener?: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export default function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const [supported] = useState(() => 'wakeLock' in navigator)
  const [locked, setLocked] = useState(false)

  const request = useCallback(async () => {
    if (!active || document.visibilityState !== 'visible') return
    const nav = navigator as NavigatorWithWakeLock
    if (!nav.wakeLock?.request || sentinelRef.current) return

    try {
      const sentinel = await nav.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setLocked(true)
      sentinel.addEventListener?.('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null
        setLocked(false)
      })
    } catch {
      setLocked(false)
    }
  }, [active])

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    if (!sentinel) return
    try { await sentinel.release() } catch {}
    setLocked(false)
  }, [])

  useEffect(() => {
    if (active) request()
    else release()
  }, [active, request, release])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) request()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [active, request])

  useEffect(() => () => { void release() }, [release])

  return { supported, locked }
}
