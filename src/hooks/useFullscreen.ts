import { useCallback, useEffect, useState } from 'react'

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export default function useFullscreen() {
  const [supported] = useState(() => {
    const doc = document as FullscreenDocument
    const root = document.documentElement as FullscreenElement
    return Boolean(document.fullscreenEnabled || root.requestFullscreen || root.webkitRequestFullscreen || doc.webkitExitFullscreen)
  })

  const readActive = () => {
    const doc = document as FullscreenDocument
    return Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
  }

  const [active, setActive] = useState(readActive)

  useEffect(() => {
    const update = () => setActive(readActive())
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('webkitfullscreenchange', update as EventListener)

    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('webkitfullscreenchange', update as EventListener)
    }
  }, [])

  const toggle = useCallback(async () => {
    if (!supported) return

    const doc = document as FullscreenDocument
    const root = document.documentElement as FullscreenElement

    try {
      if (readActive()) {
        if (document.exitFullscreen) await document.exitFullscreen()
        else await doc.webkitExitFullscreen?.()
      } else {
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' })
        else await root.webkitRequestFullscreen?.()
      }
    } catch {
      // Embedded car browsers may expose fullscreen APIs but still reject the request.
    }
  }, [supported])

  return { supported, active, toggle }
}
