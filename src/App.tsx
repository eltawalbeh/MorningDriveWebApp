import { useCallback, useEffect, useRef, useState } from 'react'
import PlaybackControls from './components/PlaybackControls'
import SequencePreview from './components/SequencePreview'
import StatusBadge from './components/StatusBadge'
import YouTubePlayerView from './components/YouTubePlayer'
import { MEDIA } from './config/media'

type AppState =
  | 'ready'
  | 'video-loading'
  | 'video-playing'
  | 'video-paused'
  | 'transitioning'
  | 'radio-loading'
  | 'radio-playing'
  | 'radio-paused'
  | 'error'

type ErrorType = 'video' | 'radio' | 'network' | null

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

export default function App() {
  const [state, setState] = useState<AppState>('ready')
  const [errorType, setErrorType] = useState<ErrorType>(null)
  const [startToken, setStartToken] = useState(0)
  const [videoTime, setVideoTime] = useState({ current: 0, duration: 0 })
  const [radioNeedsTap, setRadioNeedsTap] = useState(false)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const radioAttemptRef = useRef(0)

  const stopAll = useCallback(() => {
    try {
      playerRef.current?.stopVideo()
    } catch {}

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }

    setVideoTime({ current: 0, duration: 0 })
    setRadioNeedsTap(false)
    setErrorType(null)
    setState('ready')
  }, [])

  const prepareRadio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'none'
      audioRef.current = audio
    }

    const audio = audioRef.current
    audio.src = MEDIA.radio.streamUrl
    return audio
  }, [])

  const playRadio = useCallback(async () => {
    const attempt = ++radioAttemptRef.current
    setRadioNeedsTap(false)
    setErrorType(null)
    setState('radio-loading')

    try {
      const audio = prepareRadio()

      const timeout = window.setTimeout(() => {
        if (radioAttemptRef.current === attempt && audio.paused) {
          setErrorType('radio')
          setState('error')
        }
      }, 10000)

      const onPlaying = () => {
        window.clearTimeout(timeout)
        if (radioAttemptRef.current === attempt) {
          setRadioNeedsTap(false)
          setState('radio-playing')
        }
      }

      const onError = () => {
        window.clearTimeout(timeout)
        if (radioAttemptRef.current === attempt) {
          setErrorType('radio')
          setState('error')
        }
      }

      audio.addEventListener('playing', onPlaying, { once: true })
      audio.addEventListener('error', onError, { once: true })

      await audio.play()
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError') {
        setRadioNeedsTap(true)
        setState('radio-paused')
        return
      }

      setErrorType('radio')
      setState('error')
    }
  }, [prepareRadio])

  const beginMorningDrive = useCallback(() => {
    setErrorType(null)
    setRadioNeedsTap(false)
    setVideoTime({ current: 0, duration: 0 })
    setState('video-loading')
    setStartToken(token => token + 1)
  }, [])

  const handleVideoEnded = useCallback(() => {
    setState('transitioning')
    window.setTimeout(() => {
      playRadio()
    }, 450)
  }, [playRadio])

  const handleVideoError = useCallback(() => {
    setErrorType('video')
    setState('error')
  }, [])

  const togglePlayback = useCallback(() => {
    if (state === 'video-playing') {
      playerRef.current?.pauseVideo()
      setState('video-paused')
      return
    }

    if (state === 'video-paused') {
      playerRef.current?.playVideo()
      setState('video-playing')
      return
    }

    if (state === 'radio-playing') {
      audioRef.current?.pause()
      setState('radio-paused')
      return
    }

    if (state === 'radio-paused') {
      playRadio()
    }
  }, [state, playRadio])

  useEffect(() => {
    const handleOffline = () => {
      if (state !== 'ready') {
        setErrorType('network')
        setState('error')
      }
    }

    window.addEventListener('offline', handleOffline)
    return () => window.removeEventListener('offline', handleOffline)
  }, [state])

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy()
      } catch {}
      audioRef.current?.pause()
    }
  }, [])

  const isVideoState = state.startsWith('video')
  const isRadioState = state.startsWith('radio')
  const hasCompletedVideo = isRadioState || state === 'transitioning'
  const progress = videoTime.duration > 0 ? Math.min(100, (videoTime.current / videoTime.duration) * 100) : 0

  const retryError = () => {
    if (errorType === 'video') beginMorningDrive()
    else if (errorType === 'radio' || errorType === 'network') playRadio()
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); stopAll() }}>
          <span className="brand__mark">M</span>
          <span>Morning Drive</span>
        </a>

        <div className="topbar__status">
          <span className="connection-dot" />
          Ready for the road
        </div>
      </header>

      <section className="stage">
        {state === 'ready' && (
          <div className="ready-layout">
            <div className="hero-copy">
              <p className="eyebrow">ONE TAP. YOUR MORNING.</p>
              <h1>
                Start the drive.<br />
                <span>We’ll handle the rest.</span>
              </h1>
              <p className="hero-copy__body">
                Morning Azkar first, then Ain FM live — automatically.
              </p>

              <button className="start-button" onClick={beginMorningDrive}>
                <span className="start-button__icon" aria-hidden="true">▶</span>
                <span className="start-button__copy">
                  <strong>Morning Drive</strong>
                  <small>Tap once to begin</small>
                </span>
                <span className="start-button__arrow" aria-hidden="true">→</span>
              </button>
            </div>

            <SequencePreview />
          </div>
        )}

        {isVideoState && (
          <div className="player-layout">
            <div className="player-heading">
              <div>
                <StatusBadge label={state === 'video-paused' ? 'PAUSED' : state === 'video-loading' ? 'LOADING' : 'PLAYING'} />
                <h2>Morning Azkar</h2>
                <p>Beginning your morning with a calm start.</p>
              </div>
              <span className="step-counter">01 / 02</span>
            </div>

            <YouTubePlayerView
              startToken={startToken}
              paused={state === 'video-paused'}
              playerRef={playerRef}
              onPlaying={() => setState('video-playing')}
              onPaused={() => setState('video-paused')}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onProgress={(current, duration) => setVideoTime({ current, duration })}
            />

            <div className="progress-row" aria-label="Video progress">
              <span>{formatTime(videoTime.current)}</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span>{formatTime(videoTime.duration)}</span>
            </div>

            <div className="player-footer">
              <PlaybackControls
                isPaused={state === 'video-paused'}
                onToggle={togglePlayback}
                onStop={stopAll}
                disabled={state === 'video-loading'}
              />
              <div className="next-up">
                <span>Next automatically</span>
                <strong>Ain FM <i /> LIVE</strong>
              </div>
            </div>
          </div>
        )}

        {state === 'transitioning' && (
          <div className="center-state">
            <div className="pulse-ring"><span>02</span></div>
            <StatusBadge label="UP NEXT" />
            <h2>Starting Ain FM</h2>
            <p>Morning Azkar complete. Connecting to the live stream…</p>
            <div className="loading-line"><span /></div>
          </div>
        )}

        {isRadioState && (
          <div className="radio-layout">
            <div className="radio-orb" aria-hidden="true">
              <div className="radio-orb__inner">
                <span>AIN</span>
                <small>FM</small>
              </div>
              <i className="radio-wave radio-wave--1" />
              <i className="radio-wave radio-wave--2" />
              <i className="radio-wave radio-wave--3" />
            </div>

            <div className="radio-copy">
              <StatusBadge label="LIVE" tone="live" />
              <p className="radio-copy__eyebrow">NOW PLAYING</p>
              <h2>Ain FM</h2>
              <p>{radioNeedsTap ? 'Your browser needs one more tap to start the live stream.' : 'Live radio for the rest of your drive.'}</p>

              {radioNeedsTap && (
                <button className="fallback-radio-button" onClick={playRadio}>
                  ▶ Start Ain FM
                </button>
              )}

              <PlaybackControls
                isPaused={state === 'radio-paused'}
                onToggle={togglePlayback}
                onStop={stopAll}
                disabled={state === 'radio-loading'}
              />

              <SequencePreview compact completedVideo activeStep="radio" />
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="error-state">
            <div className="error-state__icon">!</div>
            <StatusBadge label="CONNECTION ISSUE" />
            <h2>
              {errorType === 'video' && 'Morning video could not be played.'}
              {errorType === 'radio' && 'Ain FM could not be started.'}
              {errorType === 'network' && 'Connection interrupted.'}
            </h2>
            <p>
              Check the connection and try again. You’ll stay inside Morning Drive.
            </p>

            <div className="error-actions">
              <button className="action-button action-button--primary" onClick={retryError}>Retry</button>
              {errorType === 'video' && (
                <button className="action-button" onClick={playRadio}>Skip to Radio</button>
              )}
              <button className="action-button action-button--ghost" onClick={stopAll}>Back to Start</button>
            </div>
          </div>
        )}
      </section>

      <footer className="footer">
        <span>Morning Azkar</span>
        <i />
        <span>Ain FM</span>
        <small>Built for a simple, distraction-free drive.</small>
      </footer>
    </main>
  )
}
