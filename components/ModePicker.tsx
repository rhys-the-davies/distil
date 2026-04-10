'use client'

import type { DistilMode } from '@/types/field'

interface ModePickerProps {
  selected: DistilMode
  onChange: (mode: DistilMode) => void
}

interface ModeCard {
  mode: DistilMode
  name: string
  description: string
  files: string
  disabled: boolean
}

const MODES: ModeCard[] = [
  {
    mode: 'find-issues',
    name: 'Find issues',
    description: 'Find and fix quality problems in structured data',
    files: 'CSV and Excel',
    disabled: false,
  },
  {
    mode: 'structure',
    name: 'Structure',
    description: 'Turn messy files into clean structured data',
    files: 'CSV, Excel, and plain text',
    disabled: false,
  },
  {
    mode: 'follow-schema',
    name: 'Follow schema',
    description: 'Map your data to a target structure',
    files: 'Coming soon',
    disabled: true,
  },
]

export default function ModePicker({ selected, onChange }: ModePickerProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '32px',
      }}
    >
      {MODES.map((card) => {
        const isSelected = selected === card.mode && !card.disabled

        return (
          <button
            key={card.mode}
            onClick={() => !card.disabled && onChange(card.mode)}
            disabled={card.disabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '16px',
              background: 'var(--color-white)',
              border: '0.5px solid var(--color-border-default)',
              borderLeft: isSelected
                ? '3px solid var(--color-earth)'
                : '0.5px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: card.disabled ? 'default' : 'pointer',
              opacity: card.disabled ? 0.4 : 1,
              textAlign: 'left',
              transition: 'border-color var(--transition-base)',
              paddingLeft: isSelected ? '14px' : '16px', // compensate for thicker left border
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontWeight: isSelected ? 500 : 400,
                  fontSize: '14px',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {card.name}
              </span>
              {card.disabled && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: 'var(--letter-spacing-label)',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Coming soon
                </span>
              )}
            </div>

            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
              }}
            >
              {card.description}
            </p>

            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-placeholder)',
                fontWeight: 400,
                letterSpacing: '0.02em',
              }}
            >
              {card.files}
            </span>
          </button>
        )
      })}
    </div>
  )
}
