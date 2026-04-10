import type { Field } from '@/types/field'

interface ReviewChecklistProps {
  // All action-required fields (status: review | conflict | missing).
  // resolvedValue being set means the user has confirmed it.
  fields: Field[]
}

interface BadgeConfig {
  label: string
  className: string
}

function getBadgeConfig(field: Field): BadgeConfig {
  if (field.resolvedValue !== undefined) {
    return { label: 'CONFIRMED', className: 'badge badge-clean' }
  }
  switch (field.status) {
    case 'missing':
      return { label: 'MISSING', className: 'badge badge-error' }
    case 'conflict':
      return { label: 'CONFLICT', className: 'badge badge-warning' }
    case 'review':
      return { label: 'REVIEW', className: 'badge badge-warning' }
    default:
      return { label: 'CLEAN', className: 'badge badge-clean' }
  }
}

export default function ReviewChecklist({ fields }: ReviewChecklistProps) {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <p className="label" style={{ marginBottom: '10px' }}>
        Review checklist
      </p>
      {fields.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          No action required.
        </p>
      ) : (
        <div>
          {fields.map((field, i) => {
            const badge = getBadgeConfig(field)
            const isLast = i === fields.length - 1
            return (
              <div
                key={field.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: isLast
                    ? 'none'
                    : '0.5px solid var(--color-border-default)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color:
                      field.resolvedValue !== undefined
                        ? 'var(--color-text-muted)'
                        : 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginRight: '8px',
                  }}
                >
                  {field.label}
                </span>
                <span className={badge.className} style={{ flexShrink: 0 }}>
                  {badge.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
