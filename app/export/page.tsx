'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getExtractionPayload,
  getColumnReviews,
  getSessionId,
  clearAll,
} from '@/lib/store'
import { applyCorrections } from '@/lib/corrector'
import type { ExtractionPayload, ColumnReview } from '@/types/field'

type ExportFormat = 'csv' | 'json'

const PREVIEW_ROWS = 5
const PREVIEW_MAX_COLS = 6

// ── Preview builders ──────────────────────────────────────────────────────────

interface CsvPreview {
  headers: string[]
  rows: string[][]
  totalCols: number
}

function buildCsvPreview(
  sampleRows: Record<string, Record<string, unknown>[]>,
  reviews: ColumnReview[]
): CsvPreview {
  const firstFile = Object.keys(sampleRows)[0]
  if (!firstFile) return { headers: [], rows: [], totalCols: 0 }

  const raw = sampleRows[firstFile].slice(0, PREVIEW_ROWS)
  const fileReviews = reviews.filter((r) => r.sourceFile === firstFile)
  const corrected = applyCorrections(raw, fileReviews)

  const headers = corrected.length > 0 ? Object.keys(corrected[0]) : []
  const totalCols = headers.length
  const visibleHeaders = headers.slice(0, PREVIEW_MAX_COLS)
  const visibleRows = corrected.map((row) =>
    visibleHeaders.map((h) => String(row[h] ?? ''))
  )

  return { headers: visibleHeaders, rows: visibleRows, totalCols }
}

function buildJsonPreview(
  sampleRows: Record<string, Record<string, unknown>[]>,
  reviews: ColumnReview[],
  totalRows: number
): string {
  const firstFile = Object.keys(sampleRows)[0]
  if (!firstFile) return '[]'

  const raw = sampleRows[firstFile].slice(0, 1)
  const fileReviews = reviews.filter((r) => r.sourceFile === firstFile)
  const corrected = applyCorrections(raw, fileReviews)

  const record = corrected[0] ?? {}
  const remaining = totalRows - 1
  const tail =
    remaining > 0
      ? `,\n  // ${remaining} more record${remaining !== 1 ? 's' : ''}…`
      : ''
  return `[\n  ${JSON.stringify(record, null, 2).replace(/\n/g, '\n  ')}${tail}\n]`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<ExtractionPayload | null>(null)
  const [reviews, setReviews] = useState<ColumnReview[]>([])
  const [sessionId, setSessionIdState] = useState<string | null>(null)
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
    setReviews(getColumnReviews())
    setSessionIdState(getSessionId())
  }, [router])

  function handleStartOver() {
    clearAll()
    router.push('/upload')
  }

  async function handleDownload() {
    if (!payload || !sessionId) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, format, reviews }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `Server error ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'json' ? 'json' : payload.summary.filesProcessed > 1 ? 'zip' : 'csv'
      a.download = `distil-export.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(
        err instanceof Error && err.message !== 'Server error 500'
          ? err.message
          : 'The download failed. Your reviewed data is preserved — try again. If this keeps happening, contact rhys@studiorhys.com'
      )
    } finally {
      setDownloading(false)
    }
  }

  if (!payload) return null

  // ── Derived values ──────────────────────────────────────────────────────────

  const sampleRows = payload.sampleRows ?? {}
  const totalRows = payload.summary.totalRows

  // Count distinct columns across all files
  const totalCols = Object.values(sampleRows).reduce((max, rows) => {
    const cols = rows.length > 0 ? Object.keys(rows[0]).length : 0
    return Math.max(max, cols)
  }, 0)

  // Corrections count — accounts for two special cases:
  //   rowIndex: -1 sentinel  → one correction entry that applies to every row
  //   formatRule + no overrides → format applies to all affected cells in the
  //                               column (totalAffected), not 0
  const correctionsApplied = reviews
    .filter((r) => r.status === 'corrected')
    .reduce((sum, r) => {
      if (r.formatRule && r.corrections.length === 0) {
        const field = payload.fields.find(
          (f) => f.sourceFile === r.sourceFile && f.label === r.columnName
        )
        return sum + (field?.totalAffected ?? 0)
      }
      const count = r.corrections.reduce(
        (n, c) => n + (c.rowIndex === -1 ? totalRows : 1),
        0
      )
      return sum + count
    }, 0)

  const csvPreview = buildCsvPreview(sampleRows, reviews)
  const jsonPreview = buildJsonPreview(sampleRows, reviews, totalRows)

  const downloadLabel = downloading
    ? 'Preparing download…'
    : format === 'csv'
    ? payload.summary.filesProcessed > 1
      ? 'Download ZIP'
      : 'Download CSV'
    : 'Download JSON'

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

        {/* Summary row */}
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            marginBottom: '36px',
          }}
        >
          {totalCols > 0 ? `${totalCols} column${totalCols !== 1 ? 's' : ''}` : `${payload.summary.fieldsExtracted} field${payload.summary.fieldsExtracted !== 1 ? 's' : ''}`}
          {totalRows > 0 && ` · ${totalRows} row${totalRows !== 1 ? 's' : ''}`}
          {correctionsApplied > 0
            ? ` · ${correctionsApplied} correction${correctionsApplied !== 1 ? 's' : ''} applied`
            : ' · no corrections'}
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
        <div
          className="card"
          style={{ padding: 0, marginBottom: '24px', overflow: 'hidden' }}
        >
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
            {format === 'csv' && csvPreview.totalCols > PREVIEW_MAX_COLS && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Showing {PREVIEW_MAX_COLS} of {csvPreview.totalCols} columns
              </span>
            )}
          </div>

          {format === 'csv' ? (
            csvPreview.headers.length > 0 ? (
              <>
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
                      {csvPreview.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((v, ci) => (
                            <td
                              key={ci}
                              style={{
                                padding: '8px 14px',
                                fontSize: '13px',
                                fontWeight: v ? 500 : 400,
                                color: v
                                  ? 'var(--color-text-primary)'
                                  : 'var(--color-text-placeholder)',
                                fontStyle: v ? 'normal' : 'italic',
                                whiteSpace: 'nowrap',
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                borderBottom:
                                  ri < csvPreview.rows.length - 1
                                    ? '0.5px solid var(--color-border-default)'
                                    : 'none',
                              }}
                            >
                              {v || 'empty'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    marginTop: '8px',
                    padding: '0 16px 12px',
                  }}
                >
                  This is a preview of the first 5 rows with corrections applied. The full dataset will be included in your download.
                </p>
              </>
            ) : (
              <p
                style={{
                  padding: '16px',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                }}
              >
                No preview available.
              </p>
            )
          ) : (
            <div style={{ padding: '16px', background: 'rgba(41, 8, 0, 0.025)' }}>
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
          {downloadLabel}
        </button>
      </div>
    </div>
  )
}
