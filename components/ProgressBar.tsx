interface ProgressBarProps {
  confirmed: number
  total: number
}

export default function ProgressBar({ confirmed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0

  return (
    <div style={{ marginBottom: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {confirmed} of {total} fields confirmed
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {pct}%
        </span>
      </div>
      <div
        style={{
          background: 'rgba(41, 8, 0, 0.08)',
          borderRadius: '4px',
          height: '5px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '5px',
            width: `${pct}%`,
            background: 'var(--color-earth)',
            borderRadius: '4px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
