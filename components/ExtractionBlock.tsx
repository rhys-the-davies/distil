import type { FieldConfidence, FieldConflict } from '@/types/field'

const CONF_DOT_COLOR: Record<FieldConfidence, string> = {
  high: 'var(--color-earth)',
  medium: 'var(--color-text-muted)',
  low: 'var(--color-scarlet)',
  none: 'var(--color-text-placeholder)',
}

const CONF_LABEL: Record<FieldConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
}

interface ExtractionBlockProps {
  rawValue: string | null
  interpretedValue: string | null
  confidence: FieldConfidence
  confidenceReason: string | null
  // When provided, replaces the raw→interpreted display with conflict source rows.
  conflict?: FieldConflict
}

export default function ExtractionBlock({
  rawValue,
  interpretedValue,
  confidence,
  confidenceReason,
  conflict,
}: ExtractionBlockProps) {
  return (
    <div
      style={{
        background: 'rgba(41, 8, 0, 0.03)',
        border: '0.5px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        marginBottom: '12px',
      }}
    >
      <p className="label" style={{ marginBottom: '8px' }}>
        Extraction result
      </p>

      {conflict ? (
        /* Conflict mode — list each source value */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          {conflict.sources.map((src, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}
            >
              <span
                className="mono"
                style={{ color: 'var(--color-text-muted)', flexShrink: 0, fontSize: '11px' }}
              >
                {src.file}:{src.location}
              </span>
              <span
                style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-primary)' }}
              >
                {src.value}
              </span>
              {i === conflict.defaultSource && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  (default — earliest record)
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Normal mode — raw → interpreted */
        <>
          {rawValue ? (
            <p
              className="mono"
              style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
            >
              {rawValue}
            </p>
          ) : (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                marginBottom: '4px',
                fontStyle: 'italic',
              }}
            >
              not found in any source
            </p>
          )}

          <p
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              marginBottom: '5px',
            }}
          >
            ↓ interpreted as
          </p>

          {interpretedValue ? (
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              {interpretedValue}
            </p>
          ) : (
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-scarlet)',
                marginBottom: '6px',
              }}
            >
              Field not found
            </p>
          )}
        </>
      )}

      {/* Confidence line */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <div
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: CONF_DOT_COLOR[confidence],
            flexShrink: 0,
            marginTop: '3px',
          }}
        />
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 500 }}>Confidence: {CONF_LABEL[confidence]}</span>
          {confidenceReason && ` — ${confidenceReason}`}
        </p>
      </div>
    </div>
  )
}
