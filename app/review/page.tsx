'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getExtractionPayload,
  setExtractionPayload,
  getPendingFiles,
  clearAll,
  setColumnReviews,
} from '@/lib/store'
import type { ExtractionPayload, Field, ColumnReview } from '@/types/field'
import FieldCard from '@/components/FieldCard'
import ColumnCard from '@/components/ColumnCard'
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
  const [reviews, setReviews] = useState<ColumnReview[]>([])

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

  // ── Derived state ───────────────────────────────────────────────────────────

  // Profiler fields needing action → rendered as ColumnCard
  const profilerActionFields = useMemo(
    () => fields.filter((f) => f.source === 'profiler' && f.status !== 'clean'),
    [fields]
  )

  // Extraction fields needing action → rendered as FieldCard
  const extractionActionFields = useMemo(
    () => fields.filter((f) => f.source !== 'profiler' && f.status !== 'clean'),
    [fields]
  )

  // Combined for progress bar, checklist, and metrics
  const actionRequired = useMemo(
    () => [...profilerActionFields, ...extractionActionFields],
    [profilerActionFields, extractionActionFields]
  )

  const cleanFields = useMemo(
    () => fields.filter((f) => f.status === 'clean'),
    [fields]
  )

  // resolvedValue is set on fields when confirmed (extraction fields directly,
  // profiler fields via a mirrored sentinel from handleResolve below)
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

  // ── Handlers — extraction fields (FieldCard) ────────────────────────────────

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

  // ── Handlers — profiler fields (ColumnCard) ─────────────────────────────────

  function handleResolve(review: ColumnReview) {
    // Update the reviews array (upsert by sourceFile + columnName)
    setReviews((prev) => [
      ...prev.filter(
        (r) =>
          !(r.sourceFile === review.sourceFile && r.columnName === review.columnName)
      ),
      review,
    ])
    // Mirror into the field's resolvedValue so the ProgressBar and
    // ReviewChecklist update without needing to understand ColumnReview
    setFields((prev) =>
      prev.map((f) => {
        if (
          f.source === 'profiler' &&
          f.sourceFile === review.sourceFile &&
          f.label === review.columnName
        ) {
          const desc =
            review.status === 'accepted'
              ? 'Accepted as-is'
              : review.corrections.length > 0
              ? `${review.corrections.length} correction${review.corrections.length !== 1 ? 's' : ''} applied`
              : 'Corrected'
          return { ...f, resolvedValue: desc }
        }
        return f
      })
    )
  }

  function handleUnresolve(sourceFile: string, columnName: string) {
    setReviews((prev) =>
      prev.filter(
        (r) => !(r.sourceFile === sourceFile && r.columnName === columnName)
      )
    )
    // Remove the mirrored sentinel resolvedValue from the field
    setFields((prev) =>
      prev.map((f) => {
        if (
          f.source === 'profiler' &&
          f.sourceFile === sourceFile &&
          f.label === columnName
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { resolvedValue, resolvedSource, ...rest } = f
          return rest
        }
        return f
      })
    )
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleStartOver() {
    clearAll()
    router.push('/upload')
  }

  function handleApprove() {
    if (!payload) return
    setColumnReviews(reviews)
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
        {/* ── Left column ────────────────────────────────────────────────── */}
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
              ? `${actionRequired.length} item${actionRequired.length !== 1 ? 's' : ''} need your attention before export.`
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
                Confirmed
              </p>
              <p
                style={{
                  fontSize: '26px',
                  fontWeight: 500,
                  lineHeight: 1,
                  color: 'var(--color-text-primary)',
                }}
              >
                {confirmedCount}
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

          {/* Profiler fields → ColumnCard */}
          {profilerActionFields.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <p className="label" style={{ marginBottom: '12px' }}>
                Column issues ({profilerActionFields.length})
              </p>
              {profilerActionFields.map((field) => (
                <ColumnCard
                  key={`${field.sourceFile ?? ''}::${field.label}`}
                  columnName={field.label}
                  flagType={field.flagType!}
                  confidenceReason={field.confidenceReason ?? ''}
                  offendingCells={
                    payload.offendingCells?.[field.sourceFile ?? '']?.[
                      field.label
                    ] ?? []
                  }
                  totalAffected={field.totalAffected ?? 0}
                  totalRows={field.totalRows ?? 0}
                  sourceFile={field.sourceFile ?? ''}
                  onResolve={handleResolve}
                  onUnresolve={() =>
                    handleUnresolve(field.sourceFile ?? '', field.label)
                  }
                  resolution={
                    reviews.find(
                      (r) =>
                        r.sourceFile === field.sourceFile &&
                        r.columnName === field.label
                    ) ?? null
                  }
                />
              ))}
            </div>
          )}

          {/* Extraction fields → FieldCard */}
          {extractionActionFields.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <p className="label" style={{ marginBottom: '12px' }}>
                Field review ({extractionActionFields.length})
              </p>
              {extractionActionFields.map((field) => (
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

          {/* Approve */}
          <div
            className="card"
            style={{
              padding: '20px',
              marginTop: '24px',
              borderLeft: `3px solid ${
                allResolved
                  ? 'var(--color-earth)'
                  : 'var(--color-border-default)'
              }`,
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
                  : `All items confirmed. Choose a format to download your cleaned data.`
                : `${remaining} item${remaining !== 1 ? 's' : ''} still need${remaining === 1 ? 's' : ''} your attention before export.`}
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

        {/* ── Right sidebar ─────────────────────────────────────────────── */}
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
              <FileList
                files={files}
                fieldCounts={fieldCounts}
                parsedTypes={payload.fileTypes}
              />
            </div>
          )}
          <SummaryCard payload={payload} />
          <ReviewChecklist fields={actionRequired} />
        </div>
      </div>
    </div>
  )
}
