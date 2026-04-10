// A single step row inside StepFeed.
// state: 'pending' | 'active' | 'complete' | 'error'

export type StepState = 'pending' | 'active' | 'complete' | 'error'

interface StatusRowProps {
  label: string
  detail?: string | null
  state: StepState
}

function PendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="var(--color-border-default)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function ActiveIcon() {
  return (
    // Outer track + spinning Scarlet arc
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      style={{ animation: 'distil-spin 0.9s linear infinite' }}
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="var(--color-border-default)"
        strokeWidth="1.5"
      />
      <path
        d="M 9 2 A 7 7 0 0 1 16 9"
        stroke="var(--color-scarlet)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function CompleteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="var(--color-earth)"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <path
        d="M 5.5 9 L 8 11.5 L 12.5 6.5"
        stroke="var(--color-earth)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="var(--color-scarlet)"
        strokeWidth="1.5"
      />
      <path
        d="M 6 6 L 12 12 M 12 6 L 6 12"
        stroke="var(--color-scarlet)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function StatusRow({ label, detail, state }: StatusRowProps) {
  const isActive = state === 'active'
  const isComplete = state === 'complete'
  const isError = state === 'error'
  const isPending = state === 'pending'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 0',
        opacity: isPending ? 0.35 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {state === 'pending' && <PendingIcon />}
        {state === 'active' && <ActiveIcon />}
        {state === 'complete' && <CompleteIcon />}
        {state === 'error' && <ErrorIcon />}
      </div>

      {/* Text */}
      <div>
        <p
          style={{
            fontSize: '14px',
            fontWeight: isActive ? 500 : 400,
            color: isError
              ? 'var(--color-scarlet)'
              : isComplete
              ? 'var(--color-text-muted)'
              : 'var(--color-text-primary)',
            lineHeight: 1.4,
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </p>
        {detail && isActive && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              marginTop: '2px',
            }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
