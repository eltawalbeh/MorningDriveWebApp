type SequencePreviewProps = {
  compact?: boolean
  completedVideo?: boolean
  activeStep?: 'video' | 'radio' | null
}

export default function SequencePreview({
  compact = false,
  completedVideo = false,
  activeStep = null,
}: SequencePreviewProps) {
  return (
    <div className={`sequence ${compact ? 'sequence--compact' : ''}`}>
      {!compact && <p className="sequence__eyebrow">Today’s sequence</p>}

      <div className={`sequence__item ${activeStep === 'video' ? 'sequence__item--active' : ''}`}>
        <span className={`sequence__number ${completedVideo ? 'sequence__number--done' : ''}`}>
          {completedVideo ? '✓' : '01'}
        </span>
        <div className="sequence__copy">
          <strong>Morning Azkar</strong>
          <span>{completedVideo ? 'Completed' : 'Morning video'}</span>
        </div>
      </div>

      <div className={`sequence__item ${activeStep === 'radio' ? 'sequence__item--active' : ''}`}>
        <span className="sequence__number">02</span>
        <div className="sequence__copy">
          <strong>Ain FM</strong>
          <span className="live-copy"><i /> LIVE</span>
        </div>
      </div>
    </div>
  )
}
