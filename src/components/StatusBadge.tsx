type StatusBadgeProps = {
  label: string
  tone?: 'neutral' | 'live' | 'success'
}

export default function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>
}
