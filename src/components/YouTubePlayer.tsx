import { useEffect, useRef } from 'react'
import { MEDIA } from '../config/media'

type YouTubePlayerProps = {
  startToken: number
  paused: boolean
  onPlaying: () => void
  onPaused: () => void
  onEnded: () => void
  onError: () => void
  onProgress?: (current: number, duration: number) => void
  playerRef: React.MutableRefObject<YouTubePlayer | null>
}

let apiPromise: Promise<void> | null = null

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')

    const timeout = window.setTimeout(() => reject(new Error('YouTube API timeout')), 12000)

    const finish = () => {
      window.clearTimeout(timeout)
      resolve()
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      finish()
    }

    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('YouTube API failed to load'))
      }
      document.head.appendChild(script)
    } else if (window.YT?.Player) {
      finish()
    }
  })

  return apiPromise
}

export default function YouTubePlayerView({
  startToken,
  paused,
  onPlaying,
  onPaused,
  onEnded,
  onError,
  onProgress,
  playerRef,
}: YouTubePlayerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const progressTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        await loadYouTubeApi()
        if (cancelled || !mountRef.current || !window.YT?.Player) return

        playerRef.current?.destroy()
        playerRef.current = new window.YT.Player(mountRef.current, {
          videoId: MEDIA.youtube.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
          },
          events: {
            onReady: ({ target }) => {
              target.playVideo()
              progressTimer.current = window.setInterval(() => {
                const current = target.getCurrentTime?.() || 0
                const duration = target.getDuration?.() || 0
                onProgress?.(current, duration)
              }, 1000)
            },
            onStateChange: ({ data }) => {
              const states = window.YT?.PlayerState
              if (!states) return
              if (data === states.PLAYING) onPlaying()
              if (data === states.PAUSED) onPaused()
              if (data === states.ENDED) onEnded()
            },
            onError: () => onError(),
          },
        })
      } catch {
        onError()
      }
    }

    init()

    return () => {
      cancelled = true
      if (progressTimer.current) window.clearInterval(progressTimer.current)
      progressTimer.current = null
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [startToken])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (paused) player.pauseVideo()
    else player.playVideo()
  }, [paused, playerRef])

  return (
    <div className="video-frame" aria-label="Morning Azkar video">
      <div ref={mountRef} className="video-frame__mount" />
    </div>
  )
}
