import { useCallback, useEffect, useRef, useState } from 'react'
import PlaybackControls from './components/PlaybackControls'
import SequencePreview from './components/SequencePreview'
import StatusBadge from './components/StatusBadge'
import YouTubePlayerView from './components/YouTubePlayer'
import { MEDIA } from './config/media'
import useNetworkStatus from './hooks/useNetworkStatus'
import useWakeLock from './hooks/useWakeLock'
import useLocalPreferences, { type StoredMode } from './hooks/useLocalPreferences'
import './phase6.css'

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
type SessionMode = 'sequence' | 'radio-only'

const RADIO_RETRY_DELAYS = [1500, 3000, 5000]

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

function formatLastUsed(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today at ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const wasYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate()

  if (wasYesterday) return `Yesterday at ${time}`

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`
}

export default function App() {
  const [state, setState] = useState<AppState>('ready')
  const [errorType, setErrorType] = useState<ErrorType>(null)
  const [sessionMode, setSessionMode] = useState<SessionMode>('sequence')
  const [startToken, setStartToken] = useState(0)
  const [videoTime, setVideoTime] = useState({ current: 0, duration: 0 })
  const [radioNeedsTap, setRadioNeedsTap] = useState(false)
  const [radioReconnectAttempt, setRadioReconnectAttempt] = useState(0)
  const radioReconnectRef = useRef(0)

  const online = useNetworkStatus()
  const isActive = state !== 'ready' && state !== 'error'
  const { supported: wakeLockSupported, locked: wakeLockActive } = useWakeLock(isActive)
  const { preferences, recordStart, clearHistory } = useLocalPreferences()

  const playerRef = useRef<YouTubePlayer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const radioAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)
  const manualPauseRef = useRef(false)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
  }, [])

  const cleanupAudioListeners = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.onplaying = null
    audio.onerror = null
    audio.onstalled = null
    audio.onwaiting = null
  }, [])

  const stopAll = useCallback(() => {
    clearReconnectTimer()
    radioAttemptRef.current += 1
    manualPauseRef.current = false
    try { playerRef.current?.stopVideo() } catch {}

    if (audioRef.current) {
      cleanupAudioListeners()
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }

    setVideoTime({ current: 0, duration: 0 })
    setRadioNeedsTap(false)
    radioReconnectRef.current = 0
    setRadioReconnectAttempt(0)
    setErrorType(null)
    setState('ready')
  }, [clearReconnectTimer, cleanupAudioListeners])

  const prepareRadio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'none'
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  const playRadio = useCallback(async (isReconnect = false) => {
    clearReconnectTimer()
    const attempt = ++radioAttemptRef.current
    manualPauseRef.current = false
    setRadioNeedsTap(false)
    setErrorType(null)
    setState('radio-loading')

    try {
      const audio = prepareRadio()
      cleanupAudioListeners()

      if (!audio.src || !isReconnect) audio.src = MEDIA.radio.streamUrl
      if (isReconnect) {
        audio.pause()
        audio.load()
      }

      const failAfterTimeout = window.setTimeout(() => {
        if (radioAttemptRef.current === attempt && audio.paused && !manualPauseRef.current) {
          setErrorType('radio')
          setState('error')
        }
      }, 10000)

      const scheduleReconnect = () => {
        if (manualPauseRef.current || !navigator.onLine || radioAttemptRef.current !== attempt) return
        const currentAttempt = Math.min(radioReconnectRef.current, RADIO_RETRY_DELAYS.length - 1)
        if (radioReconnectRef.current >= RADIO_RETRY_DELAYS.length) {
          window.clearTimeout(failAfterTimeout)
          setErrorType('radio')
          setState('error')
          return
        }
        radioReconnectRef.current += 1
        setRadioReconnectAttempt(radioReconnectRef.current)
        setState('radio-loading')
        reconnectTimerRef.current = window.setTimeout(() => {
          void playRadio(true)
        }, RADIO_RETRY_DELAYS[currentAttempt])
      }

      audio.onplaying = () => {
        window.clearTimeout(failAfterTimeout)
        if (radioAttemptRef.current === attempt) {
          radioReconnectRef.current = 0
          setRadioReconnectAttempt(0)
          setRadioNeedsTap(false)
          setState('radio-playing')
        }
      }
      audio.onerror = scheduleReconnect
      audio.onstalled = scheduleReconnect
      audio.onwaiting = () => {
        if (!manualPauseRef.current) setState('radio-loading')
      }

      await audio.play()
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError') {
        setRadioNeedsTap(true)
        setState('radio-paused')
        return
      }
      if (!navigator.onLine) {
        setErrorType('network')
        setState('error')
        return
      }
      setErrorType('radio')
      setState('error')
    }
  }, [clearReconnectTimer, cleanupAudioListeners, prepareRadio])

  const beginMorningDrive = useCallback((remember = true) => {
    if (remember) recordStart('sequence')
    setSessionMode('sequence')
    setErrorType(null)
    setRadioNeedsTap(false)
    radioReconnectRef.current = 0
    setRadioReconnectAttempt(0)
    setVideoTime({ current: 0, duration: 0 })
    setState('video-loading')
    setStartToken(token => token + 1)
  }, [recordStart])

  const beginRadioOnly = useCallback((remember = true) => {
    if (remember) recordStart('radio-only')
    setSessionMode('radio-only')
    radioReconnectRef.current = 0
    setRadioReconnectAttempt(0)
    void playRadio()
  }, [playRadio, recordStart])

  const startStoredMode = useCallback((mode: StoredMode) => {
    if (mode === 'radio-only') beginRadioOnly()
    else beginMorningDrive()
  }, [beginMorningDrive, beginRadioOnly])

  const handleVideoEnded = useCallback(() => {
    setState('transitioning')
    window.setTimeout(() => { void playRadio() }, 450)
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
    if (state === 'radio-playing' || state === 'radio-loading') {
      clearReconnectTimer()
      manualPauseRef.current = true
      audioRef.current?.pause()
      setState('radio-paused')
      return
    }
    if (state === 'radio-paused') void playRadio()
  }, [state, clearReconnectTimer, playRadio])

  useEffect(() => {
    if (!online && state !== 'ready') {
      clearReconnectTimer()
      setErrorType('network')
      setState('error')
    }
  }, [online, state, clearReconnectTimer])

  useEffect(() => {
    document.title = state === 'radio-playing'
      ? 'Ain FM • Morning Drive'
      : state.startsWith('video')
        ? 'Morning Azkar • Morning Drive'
        : 'Morning Drive'
  }, [state])

  useEffect(() => () => {
    clearReconnectTimer()
    try { playerRef.current?.destroy() } catch {}
    audioRef.current?.pause()
  }, [clearReconnectTimer])

  const isVideoState = state.startsWith('video')
  const isRadioState = state.startsWith('radio')
  const completedVideo = sessionMode === 'sequence' && isRadioState
  const progress = videoTime.duration > 0 ? Math.min(100, (videoTime.current / videoTime.duration) * 100) : 0
  const radioStatus = state === 'radio-loading'
    ? radioReconnectAttempt > 0 ? `Reconnecting… ${radioReconnectAttempt}/${RADIO_RETRY_DELAYS.length}` : 'Connecting…'
    : radioNeedsTap ? 'Tap once to start the live stream.' : 'Live radio for the rest of your drive.'

  const lastUsed = formatLastUsed(preferences.lastStartedAt)
  const lastModeLabel = preferences.lastMode === 'radio-only' ? 'Radio Only' : 'Morning Drive'

  const retryError = () => {
    if (errorType === 'video') beginMorningDrive(false)
    else if (errorType === 'radio' || errorType === 'network') void playRadio()
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <div className="sr-only" aria-live="polite">
        {state === 'radio-playing' ? 'Ain FM is playing' : state.replaceAll('-', ' ')}
      </div>

      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); stopAll() }}>
          <span className="brand__mark">M</span>
          <span>Morning Drive</span>
        </a>

        <div className={`topbar__status ${online ? '' : 'topbar__status--offline'}`}>
          <span className="connection-dot" />
          {online ? 'Connected' : 'Offline'}
          {isActive && wakeLockSupported && <span className="status-separator">•</span>}
          {isActive && wakeLockSupported && <span>{wakeLockActive ? 'Screen awake' : 'Screen wake unavailable'}</span>}
        </div>
      </header>

      <section className="stage">
        {state === 'ready' && (
          <div className="ready-layout">
            <div className="hero-copy">
              <p className="eyebrow">ONE TAP. YOUR MORNING.</p>
              <h1>Start the drive.<br /><span>We’ll handle the rest.</span></h1>
              <p className="hero-copy__body">Morning Azkar first, then Ain FM live — automatically.</p>

              <div className="home-actions">
                <button className="start-button" onClick={() => beginMorningDrive()}>
                  <span className="start-button__icon" aria-hidden="true">▶</span>
                  <span className="start-button__copy"><strong>Morning Drive</strong><small>Azkar → Ain FM</small></span>
                  <span className="start-button__arrow" aria-hidden="true">→</span>
                </button>

                <button className="radio-only-button" onClick={() => beginRadioOnly()}>
                  <span className="radio-only-button__live"><i /> LIVE</span>
                  <span><strong>Radio Only</strong><small>Go straight to Ain FM</small></span>
                  <span aria-hidden="true">→</span>
                </button>

                {preferences.lastMode && (
                  <div className="memory-card">
                    <div className="memory-card__copy">
                      <span className="memory-card__label">LAST USED</span>
                      <strong>{lastModeLabel}</strong>
                      <small>{lastUsed || 'Saved on this browser'}</small>
                    </div>

                    <div className="memory-card__actions">
                      <button
                        className="memory-repeat-button"
                        onClick={() => startStoredMode(preferences.lastMode!)}
                      >
                        Repeat
                        <span aria-hidden="true">→</span>
                      </button>
                      <button className="memory-clear-button" onClick={clearHistory}>
                        Forget
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="home-side">
              <SequencePreview />
              {preferences.startCount > 0 && (
                <div className="local-memory-note">
                  <span className="local-memory-note__dot" />
                  <div>
                    <strong>Remembered on this screen</strong>
                    <span>{preferences.startCount} {preferences.startCount === 1 ? 'start' : 'starts'} saved locally</span>
                  </div>
                </div>
              )}
            </div>
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
              <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <span>{formatTime(videoTime.duration)}</span>
            </div>

            <div className="player-footer">
              <PlaybackControls isPaused={state === 'video-paused'} onToggle={togglePlayback} onStop={stopAll} disabled={state === 'video-loading'} />
              <div className="next-up"><span>Next automatically</span><strong>Ain FM <i /> LIVE</strong></div>
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
            <div className={`radio-orb ${state === 'radio-loading' ? 'radio-orb--loading' : ''}`} aria-hidden="true">
              <div className="radio-orb__inner"><span>AIN</span><small>FM</small></div>
              <i className="radio-wave radio-wave--1" /><i className="radio-wave radio-wave--2" /><i className="radio-wave radio-wave--3" />
            </div>

            <div className="radio-copy">
              <StatusBadge label={state === 'radio-loading' ? 'CONNECTING' : state === 'radio-paused' ? 'PAUSED' : 'LIVE'} tone={state === 'radio-playing' ? 'live' : 'neutral'} />
              <p className="radio-copy__eyebrow">{sessionMode === 'radio-only' ? 'RADIO ONLY' : 'NOW PLAYING'}</p>
              <h2>Ain FM</h2>
              <p>{radioStatus}</p>

              {radioNeedsTap && <button className="fallback-radio-button" onClick={() => void playRadio()}>▶ Start Ain FM</button>}

              <PlaybackControls
                isPaused={state === 'radio-paused'}
                onToggle={togglePlayback}
                onStop={stopAll}
                disabled={state === 'radio-loading' && !radioReconnectAttempt}
              />

              {sessionMode === 'sequence'
                ? <SequencePreview compact completedVideo={completedVideo} activeStep="radio" />
                : <div className="radio-only-note"><span className="live-copy"><i /> LIVE</span><strong>Direct to Ain FM</strong></div>}
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="error-state">
            <div className="error-state__icon">!</div>
            <StatusBadge label={errorType === 'network' ? 'OFFLINE' : 'CONNECTION ISSUE'} />
            <h2>
              {errorType === 'video' && 'Morning video could not be played.'}
              {errorType === 'radio' && 'Ain FM could not be started.'}
              {errorType === 'network' && 'Connection interrupted.'}
            </h2>
            <p>{errorType === 'network' ? 'Morning Drive will be ready to reconnect as soon as the connection returns.' : 'Check the connection and try again. You’ll stay inside Morning Drive.'}</p>

            <div className="error-actions">
              <button className="action-button action-button--primary" onClick={retryError} disabled={!online}>Retry</button>
              {errorType === 'video' && <button className="action-button" onClick={() => beginRadioOnly(false)}>Skip to Radio</button>}
              <button className="action-button action-button--ghost" onClick={stopAll}>Back to Start</button>
            </div>
          </div>
        )}
      </section>

      <footer className="footer">
        <span>Morning Azkar</span><i /><span>Ain FM</span>
        <small>Built for a simple, distraction-free drive.</small>
      </footer>
    </main>
  )
}
