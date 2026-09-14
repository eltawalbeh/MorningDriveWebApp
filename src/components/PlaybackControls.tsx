import { useEffect, useState } from 'react'
import useFullscreen from '../hooks/useFullscreen'

type PlaybackControlsProps = {
  isPaused: boolean
  onToggle: () => void
  onStop: () => void
  disabled?: boolean
}

export default function PlaybackControls({
  isPaused,
  onToggle,
  onStop,
  disabled = false,
}: PlaybackControlsProps) {
  const [stopArmed, setStopArmed] = useState(false)
  const { supported: fullscreenSupported, active: fullscreenActive, toggle: toggleFullscreen } = useFullscreen()

  useEffect(() => {
    if (!stopArmed) return
    const timer = window.setTimeout(() => setStopArmed(false), 2200)
    return () => window.clearTimeout(timer)
  }, [stopArmed])

  const handleStop = () => {
    if (!stopArmed) {
      setStopArmed(true)
      return
    }

    setStopArmed(false)
    onStop()
  }

  return (
    <div className="playback-controls" aria-label="Playback controls">
      <button
        className="control-button control-button--primary"
        onClick={onToggle}
        disabled={disabled}
        type="button"
        aria-label={isPaused ? 'Resume playback' : 'Pause playback'}
      >
        <span className="control-button__icon" aria-hidden="true">
          {isPaused ? '▶' : 'Ⅱ'}
        </span>
        <span>{isPaused ? 'Play' : 'Pause'}</span>
      </button>

      <button
        className={`control-button control-button--stop ${stopArmed ? 'control-button--armed' : ''}`}
        onClick={handleStop}
        type="button"
        aria-label={stopArmed ? 'Tap again to stop playback' : 'Stop playback'}
      >
        <span className="control-button__icon" aria-hidden="true">
          {stopArmed ? '!' : '■'}
        </span>
        <span>{stopArmed ? 'Tap again' : 'Stop'}</span>
      </button>

      {fullscreenSupported && (
        <button
          className="control-button control-button--screen"
          onClick={() => void toggleFullscreen()}
          type="button"
          aria-label={fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <span className="control-button__icon control-button__icon--screen" aria-hidden="true">
            {fullscreenActive ? '↙' : '↗'}
          </span>
          <span>{fullscreenActive ? 'Exit' : 'Full screen'}</span>
        </button>
      )}
    </div>
  )
}
