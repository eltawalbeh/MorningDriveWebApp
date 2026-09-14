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
  return (
    <div className="playback-controls" aria-label="Playback controls">
      <button className="control-button control-button--primary" onClick={onToggle} disabled={disabled}>
        <span className="control-button__icon" aria-hidden="true">
          {isPaused ? '▶' : 'Ⅱ'}
        </span>
        <span>{isPaused ? 'Play' : 'Pause'}</span>
      </button>

      <button className="control-button" onClick={onStop}>
        <span className="control-button__icon" aria-hidden="true">■</span>
        <span>Stop</span>
      </button>
    </div>
  )
}
