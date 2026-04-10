'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getExtractionPayload, getPendingFiles, clearAll } from '@/lib/store'
import type { ExtractionPayload, Field } from '@/types/field'
import FieldCard from '@/components/FieldCard'
import ProcessedFieldsTable from '@/components/ProcessedFieldsTable'
import ProgressBar from '@/components/ProgressBar'
import SummaryCard from '@/components/SummaryCard'
import ReviewChecklist from '@/components/ReviewChecklist'
import FileList, { type FieldCounts } from '@/components/FileList'

export default function ReviewPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<ExtractionPayload | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fields, setFields] = useState<Field[]>([])

  useEffect(() => {
    const p = getExtractionPayload()
    if (!p) {
      router.replace('/upload')
      return
    }
    setPayload(p)
    setFields(p.fields)
    setFiles(getPendingFiles())
  }, [router])

  // Derived
  const actionRequired = useMemo(
    () => fields.filter((f) => f.status !== 'clean'),
    [fields]
  )
  const cleanFields = useMemo(
    () => fields.filter((f) => f.status === 'clean'),
    [fields]
  )
  const confirmedCount = useMemo(
    () => actionRequired.filter((f) => f.resolvedValue !== undefined).length,
    [actionRequired]
  )
  const allResolved =
    actionRequired.length === 0 || confirmedCount === actionRequired.length

  // Per-file counts for sidebar FileList
  const fieldCounts = useMemo<FieldCounts[]>(() => {
    return files.map((file) => {
      const ff = fields.filter((f) => f.sourceFile === file.name)
      return {
        clean: ff.filter((f) => f.status === 'clean').length,
        review: ff.filter((f) => f.status === 'review').length,
        conflict: ff.filter((f) => f.status === 'conflict').length,
        missing: ff.filter((f) => f.status === 'missing').length,
      }
    })
  }, [files, fields])

  function handleConfirm(id: string, value: string, source?: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, resolvedValue: value, resolvedSource: source } : f
      )
    )
  }

  function handleUnconfirm(id: string) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resolvedValue, resolvedSource, ...rest } = f
        return rest
      })
    )
  }

  function handleStartOver() {
    clearAll()
    router.push('/upload')
  }

  function handleApprove() {
    if (!payload) return
    setExtractionPayload({ ...payload, fields })
    router.push('/export')
  }

  if (!payload) return null

  const remaining = actionRequired.length - confirmedCount

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

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '32px 24px 80px',
          alignItems: 'start',
        }}
      >
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="heading-display" style={{ marginBottom: '6px' }}>
            Review extraction
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-text-muted)',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}
          >
            {payload.summary.filesProcessed} file
            {payload.summary.filesProcessed !== 1 ? 's' : ''} processed,{' '}
            {payload.summary.fieldsExtracted} field
            {payload.summary.fieldsExtracted !== 1 ? 's' : ''} extracted.{' '}
            {actionRequired.length > 0
              ? `${actionRequired.length} field${actionRequired.length !== 1 ? 's' : ''} need your attention before export.`
              : 'All fields extracted cleanly — ready to export.'}
          </p>

          {/* Progress */}
          {actionRequired.length > 0 && (
            <ProgressBar confirmed={confirmedCount} total={actionRequired.length} />
          )}

          {/* 3-up metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '28px',
            }}
          >
            <div className="card" style={{ padding: '14px 16px' }}>
              <p className="label" style={{ marginBottom: '4px' }}>
                Needs action
              </p>
              <p
                style={{
                  fontSize: '26px',
                  fontWeight: 500,
                  lineHeight: 1,
                  color:
                    actionRequired.length > 0
                      ? 'var(--color-scarlet)'
                      : 'var(--color-text-primary)',
                }}
              >
                {actionRequired.length}
              </p>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <p className="label" style={{ marginBottom: '4px' }}>
                Conflicts
              </p>
              <p
                style={{
                  fontSize: '26px',
                  fontWeight: 500,
                  lineHeight: 1,
                  color:
                    payload.summary.conflicts > 0
                      ? 'var(--color-status-warning)'
                      : 'var(--color-text-primary)',
                }}
              >
                {payload.summary.conflicts}
              </p>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <p className="label" style={{ marginBottom: '4px' }}>
                Clean fields
              </p>
              <p
                style={{
                  fontSize: '26px',
                  fontWeight: 500,
                  lineHeight: 1,
                  color: 'var(--color-text-primary)',
                }}
              >
                {cleanFields.length}
              </p>
            </div>
          </div>

          {/* Action-required FieldCards */}
          {actionRequired.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <p className="label" style={{ marginBottom: '12px' }}>
                Action required ({actionRequired.length})
              </p>
              {actionRequired.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onConfirm={handleConfirm}
                  onUnconfirm={handleUnconfirm}
                />
              ))}
            </div>
          )}

          {/* Clean fields table */}
          <ProcessedFieldsTable fields={cleanFields} />

          {/* Feedback */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <p className="label" style={{ marginBottom: '4px' }}>
              Feedback
            </p>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                marginBottom: '10px',
                lineHeight: 1.5,
              }}
            >
              Spotted a mistake or want the extraction to behave differently?
            </p>
            <textarea
              className="input"
              placeholder="e.g. The date format was wrong, or a field was missed…"
              rows={3}
              style={{
                resize: 'vertical',
                minHeight: '70px',
                marginBottom: '8px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled
              style={{ fontSize: '13px', opacity: 0.45, cursor: 'not-allowed' }}
            >
              Re-run review — coming soon
            </button>
          </div>

          {/* Approve */}
          <div
            className="card"
            style={{
              padding: '20px',
              borderLeft: `3px solid ${allResolved ? 'var(--color-earth)' : 'var(--color-border-default)'}`,
              borderRadius: `0 var(--radius-md) var(--radius-md) 0`,
              transition: 'border-left-color 0.3s ease',
            }}
          >
            <p
              style={{
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              Ready to export?
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                marginBottom: '16px',
                lineHeight: 1.5,
              }}
            >
              {allResolved
                ? actionRequired.length === 0
                  ? 'All fields are clean. Choose a format to download your cleaned data.'
                  : `All ${actionRequired.length} field${actionRequired.length !== 1 ? 's' : ''} confirmed. Choose a format to download your cleaned data.`
                : `${remaining} field${remaining !== 1 ? 's' : ''} still need${remaining === 1 ? 's' : ''} your attention before export.`}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!allResolved}
              onClick={handleApprove}
              style={{
                fontSize: '14px',
                opacity: allResolved ? 1 : 0.35,
                cursor: allResolved ? 'pointer' : 'not-allowed',
              }}
            >
              Choose export format →
            </button>
          </div>
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'sticky',
            top: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {files.length > 0 && (
            <div>
              <p className="label" style={{ marginBottom: '10px' }}>
                Source files
              </p>
              <FileList files={files} fieldCounts={fieldCounts} parsedTypes={payload.fileTypes} />
            </div>
          )}
          <SummaryCard payload={payload} />
          <ReviewChecklist fields={actionRequired} />
        </div>
      </div>
    </div>
  )
}
