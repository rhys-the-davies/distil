import type { ExtractionPayload } from '@/types/field'

interface SummaryCardProps {
  payload: ExtractionPayload
}

interface StatRowProps {
  label: string
  value: number | string
  alert?: boolean
}

function StatRow({ label, value, alert }: StatRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '0.5px solid var(--color-border-default)',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: alert ? 'var(--color-scarlet)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function SummaryCard({ payload }: SummaryCardProps) {
  const { summary } = payload
  const issuesFound = summary.warnings + summary.missingRequired

  return (
    <div className="card" style={{ padding: '16px' }}>
      <p className="label" style={{ marginBottom: '10px' }}>
        Import summary
      </p>
      <div>
        <StatRow label="Files processed" value={summary.filesProcessed} />
        <StatRow label="Fields extracted" value={summary.fieldsExtracted} />
        <StatRow
          label="Source conflicts"
          value={summary.conflicts}
          alert={summary.conflicts > 0}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Issues found</span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: issuesFound > 0 ? 'var(--color-scarlet)' : 'var(--color-text-primary)',
            }}
          >
            {issuesFound}
          </span>
        </div>
      </div>
    </div>
  )
}
