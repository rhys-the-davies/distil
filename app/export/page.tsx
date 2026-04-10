'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getExtractionPayload, clearAll } from '@/lib/store'
import type { ExtractionPayload, Field } from '@/types/field'

type ExportFormat = 'csv' | 'json'

const PREVIEW_MAX_COLS = 6
const PREVIEW_MAX_JSON_FIELDS = 6

function fieldValue(field: Field): string {
  return field.resolvedValue ?? field.interpretedValue ?? field.rawValue ?? ''
}

function buildCsvPreview(fields: Field[]): { headers: string[]; row: string[]; extraCols: number } {
  const headers = fields.map((f) => f.label)
  const row = fields.map(fieldValue)
  return {
    headers: headers.slice(0, PREVIEW_MAX_COLS),
    row: row.slice(0, PREVIEW_MAX_COLS),
    extraCols: Math.max(0, headers.length - PREVIEW_MAX_COLS),
  }
}

function buildJsonPreviewText(fields: Field[]): string {
  const preview = fields.slice(0, PREVIEW_MAX_JSON_FIELDS)
  const extra = fields.length - preview.length
  const lines = preview.map((f) => `  "${f.id}": ${JSON.stringify(fieldValue(f))}`)
  const body = lines.join(',\n')
  const tail = extra > 0 ? `,\n  // ${extra} more field${extra !== 1 ? 's' : ''}…` : ''
  return `{\n${body}${tail}\n}`
}

export default function ExportPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<ExtractionPayload | null>(null)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    const p = getExtractionPayload()
    if (!p) {
      router.replace('/upload')
      return
    }
    setPayload(p)
  }, [router])

  function handleStartOver() {
    clearAll()
    router.push('/upload')
  }

  async function handleDownload() {
    if (!payload) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, format }),
      })
      if (!res.ok) {
        throw new Error('server error')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `distil-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError(
        `The download failed. Your reviewed data is preserved — try again. If this keeps happening, contact rhys@studiorhys.com`
      )
    } finally {
      setDownloading(false)
    }
  }

  if (!payload) return null

  const totalFields = payload.fields.length
  const sourcesCount = payload.summary.filesProcessed

  const csvPreview = buildCsvPreview(payload.fields)
  const jsonPreview = buildJsonPreviewText(payload.fields)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-snow)' }}>
      {/* Topbar */}
      <div
        style={{
          background: 'var(--color-white)',
          borderBottom: '0.5px solid var(--color-border-default)',
          padding: '0 32px',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--color-scarlet)',
            letterSpacing: '-0.01em',
          }}
        >
          Distil
        </span>
        <button
          type="button"
          className="btn-tertiary"
          onClick={handleStartOver}
          style={{ fontSize: '13px' }}
        >
          Start over
        </button>
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        <h1 className="heading-display" style={{ marginBottom: '6px' }}>
          Your data is ready
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            marginBottom: '36px',
          }}
        >
          {totalFields} field{totalFields !== 1 ? 's' : ''} confirmed ·{' '}
          {sourcesCount} source{sourcesCount !== 1 ? 's' : ''} merged
        </p>

        {/* Format picker */}
        <p className="label" style={{ marginBottom: '10px' }}>
          Choose format
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '24px',
          }}
        >
          {(
            [
              {
                value: 'csv' as ExportFormat,
                title: 'CSV',
                desc: 'Opens in Excel, Google Sheets, or any data tool',
              },
              {
                value: 'json' as ExportFormat,
                title: 'JSON',
                desc: 'For developers piping output to another system',
              },
            ] as const
          ).map(({ value, title, desc }) => {
            const selected = format === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                style={{
                  textAlign: 'left',
                  background: 'var(--color-white)',
                  border: `0.5px solid ${selected ? 'var(--color-border-emphasis)' : 'var(--color-border-default)'}`,
                  borderLeft: `3px solid ${selected ? 'var(--color-earth)' : 'var(--color-border-default)'}`,
                  borderRadius: `0 var(--radius-md) var(--radius-md) 0`,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-base)',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {title}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {desc}
                </p>
              </button>
            )
          })}
        </div>

        {/* Preview panel */}
        <div className="card" style={{ padding: 0, marginBottom: '24px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '0.5px solid var(--color-border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <p className="label">Preview</p>
            {format === 'csv' && csvPreview.extraCols > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Showing {PREVIEW_MAX_COLS} of {payload.fields.length} columns
              </span>
            )}
            {format === 'json' && payload.fields.length > PREVIEW_MAX_JSON_FIELDS && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Showing {PREVIEW_MAX_JSON_FIELDS} of {payload.fields.length} fields
              </span>
            )}
          </div>

          {format === 'csv' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {csvPreview.headers.map((h, i) => (
                      <th
                        key={i}
                        style={{
                          textAlign: 'left',
                          padding: '8px 14px',
                          fontSize: '10px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--color-text-muted)',
                          borderBottom: '0.5px solid var(--color-border-default)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {csvPreview.row.map((v, i) => (
                      <td
                        key={i}
                        style={{
                          padding: '10px 14px',
                          fontSize: '13px',
                          fontWeight: v ? 500 : 400,
                          color: v ? 'var(--color-text-primary)' : 'var(--color-text-placeholder)',
                          fontStyle: v ? 'normal' : 'italic',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {v || 'empty'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: '16px',
                background: 'rgba(41, 8, 0, 0.025)',
              }}
            >
              <pre
                className="mono"
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.7,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {jsonPreview}
              </pre>
            </div>
          )}
        </div>

        {/* Download error */}
        {downloadError && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-scarlet)',
              marginBottom: '10px',
              lineHeight: 1.5,
            }}
          >
            {downloadError}
          </p>
        )}

        {/* Download button */}
        <button
          type="button"
          className="btn btn-primary"
          disabled={downloading}
          onClick={handleDownload}
          style={{ width: '100%', padding: '14px 20px', fontSize: '15px' }}
        >
          {downloading ? 'Preparing download…' : `Download ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  )
}
