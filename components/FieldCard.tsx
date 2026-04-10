'use client'

import { useEffect, useState } from 'react'
import ExtractionBlock from './ExtractionBlock'
import type { Field, FieldStatus, FieldConflict, ContextMessage } from '@/types/field'

// ── Internal sub-components ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: FieldStatus }) {
  const configs: Record<FieldStatus, { label: string; className: string }> = {
    missing: { label: 'MISSING', className: 'badge badge-error' },
    conflict: { label: 'CONFLICT', className: 'badge badge-warning' },
    review: { label: 'NEEDS REVIEW', className: 'badge badge-warning' },
    clean: { label: 'CLEAN', className: 'badge badge-clean' },
  }
  const { label, className } = configs[status]
  return <span className={className}>{label}</span>
}

function Chip({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'location' | 'error' }) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: 'rgba(41, 8, 0, 0.05)',
      color: 'var(--color-text-muted)',
      border: '0.5px solid var(--color-border-default)',
    },
    location: {
      background: 'rgba(41, 8, 0, 0.07)',
      color: 'var(--color-text-muted)',
      border: '0.5px solid rgba(41, 8, 0, 0.15)',
    },
    error: {
      background: 'rgba(255, 51, 0, 0.08)',
      color: 'var(--color-scarlet)',
      border: '0.5px solid rgba(255, 51, 0, 0.15)',
    },
  }
  return (
    <span
      className="mono"
      style={{
        ...styles[variant],
        fontSize: '10px',
        borderRadius: '4px',
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </span>
  )
}

function SourceChips({ field }: { field: Field }) {
  if (field.status === 'missing') {
    return (
      <div style={{ marginTop: '5px' }}>
        <Chip variant="error">required field · not found in any source</Chip>
      </div>
    )
  }

  if (field.status === 'conflict' && field.conflict) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
        {field.conflict.sources.map((src, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {i > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '0 2px' }}>+</span>
            )}
            <Chip>{src.file}</Chip>
            <Chip variant="location">{src.location}</Chip>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
      {field.sourceFile && <Chip>{field.sourceFile}</Chip>}
      {field.sourceLocation && <Chip variant="location">{field.sourceLocation}</Chip>}
    </div>
  )
}

function ContextStrip({ context }: { context: ContextMessage[] }) {
  if (context.length === 0) return null
  return (
    <div
      style={{
        borderTop: '0.5px solid var(--color-border-default)',
        background: 'rgba(41, 8, 0, 0.025)',
        padding: '10px 16px',
      }}
    >
      <p className="label" style={{ marginBottom: '8px' }}>
        Source context
      </p>
      {context.map((msg, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: i < context.length - 1 ? '4px' : '0',
            background: msg.highlight ? 'rgba(41, 8, 0, 0.06)' : 'transparent',
            borderRadius: '3px',
            padding: msg.highlight ? '2px 4px' : '0',
          }}
        >
          <span
            style={{
              fontWeight: 500,
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              minWidth: '56px',
              flexShrink: 0,
            }}
          >
            {msg.who}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: msg.highlight ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontWeight: msg.highlight ? 500 : 400,
              lineHeight: 1.5,
            }}
          >
            {msg.text}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Action areas ─────────────────────────────────────────────────────────────

interface MissingActionsProps {
  field: Field
  inputValue: string
  onInputChange: (v: string) => void
  onConfirm: (id: string, value: string, source?: string) => void
}

function MissingActions({ field, inputValue, onInputChange, onConfirm }: MissingActionsProps) {
  return (
    <div>
      <input
        className="input"
        type="text"
        placeholder="Enter value"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        style={{ marginBottom: '8px' }}
      />
      <button
        type="button"
        className="btn btn-secondary"
        disabled={inputValue.trim().length < 2}
        onClick={() => onConfirm(field.id, inputValue.trim(), 'Manual entry')}
        style={{ fontSize: '13px' }}
      >
        Confirm entry
      </button>
    </div>
  )
}

interface ReviewActionsProps {
  field: Field
  editMode: boolean
  inputValue: string
  onEditMode: (v: boolean) => void
  onInputChange: (v: string) => void
  onConfirm: (id: string, value: string, source?: string) => void
}

function ReviewActions({
  field,
  editMode,
  inputValue,
  onEditMode,
  onInputChange,
  onConfirm,
}: ReviewActionsProps) {
  if (!editMode) {
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            onConfirm(
              field.id,
              field.interpretedValue ?? field.rawValue ?? '',
              field.sourceFile ?? undefined
            )
          }
          style={{ fontSize: '13px' }}
        >
          Confirm
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            onEditMode(true)
            onInputChange(field.interpretedValue ?? field.rawValue ?? '')
          }}
          style={{ fontSize: '13px' }}
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        className="input"
        type="text"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        style={{ marginBottom: '8px' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={inputValue.trim().length < 2}
          onClick={() => onConfirm(field.id, inputValue.trim(), 'Manually corrected')}
          style={{ fontSize: '13px' }}
        >
          Confirm
        </button>
        <button
          type="button"
          className="btn-tertiary"
          onClick={() => onEditMode(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface ConflictActionsProps {
  field: Field
  conflict: FieldConflict
  editMode: boolean
  inputValue: string
  onEditMode: (v: boolean) => void
  onInputChange: (v: string) => void
  onConfirm: (id: string, value: string, source?: string) => void
}

function ConflictActions({
  field,
  conflict,
  editMode,
  inputValue,
  onEditMode,
  onInputChange,
  onConfirm,
}: ConflictActionsProps) {
  if (!editMode) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {conflict.sources.map((src, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-secondary"
              onClick={() => onConfirm(field.id, src.value, src.file)}
              style={{ fontSize: '12px' }}
            >
              Use {src.value} ({src.file})
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-tertiary"
          onClick={() => {
            onEditMode(true)
            onInputChange('')
          }}
        >
          Enter correct value ↓
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        className="input"
        type="text"
        placeholder="Enter the correct value"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        style={{ marginBottom: '8px' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={inputValue.trim().length < 2}
          onClick={() => onConfirm(field.id, inputValue.trim(), 'Manually entered')}
          style={{ fontSize: '13px' }}
        >
          Confirm
        </button>
        <button
          type="button"
          className="btn-tertiary"
          onClick={() => onEditMode(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── FieldCard ────────────────────────────────────────────────────────────────

export interface FieldCardProps {
  field: Field
  onConfirm: (id: string, value: string, source?: string) => void
  onUnconfirm: (id: string) => void
}

export default function FieldCard({ field, onConfirm, onUnconfirm }: FieldCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const isConfirmed = field.resolvedValue !== undefined

  // Reset local edit state when a field transitions back to unconfirmed ("Change")
  useEffect(() => {
    if (!isConfirmed) {
      setEditMode(false)
      setInputValue('')
    }
  }, [isConfirmed])

  // ── Left border colour ────────────────────────────────────────────────────
  const borderLeftColor = isConfirmed
    ? 'var(--color-earth)'
    : field.status === 'missing'
    ? 'var(--color-scarlet)'
    : 'var(--color-status-warning)'

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-white)',
    border: '0.5px solid var(--color-border-default)',
    borderLeft: `3px solid ${borderLeftColor}`,
    borderRadius: `0 var(--radius-md) var(--radius-md) 0`,
    marginBottom: '8px',
    overflow: 'hidden',
    transition: 'border-left-color 0.2s ease',
  }

  // ── Confirmed state — compact single row ──────────────────────────────────
  if (isConfirmed) {
    return (
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {field.label}
          </span>
          <span style={{ color: 'var(--color-border-emphasis)', fontSize: '12px' }}>·</span>
          <span
            className="mono"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              flex: 1,
              minWidth: 0,
            }}
          >
            {field.resolvedValue}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {field.resolvedSource ?? field.sourceFile ?? 'Confirmed'}
          </span>
          <button
            type="button"
            className="btn-tertiary"
            onClick={() => onUnconfirm(field.id)}
            style={{ fontSize: '11px', flexShrink: 0 }}
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  // ── Unresolved state — full card ──────────────────────────────────────────
  return (
    <div style={cardStyle}>
      {/* Main content */}
      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '0',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {field.label}
            </span>
            <StatusBadge status={field.status} />
          </div>
          <SourceChips field={field} />
        </div>

        {/* Extraction block */}
        <ExtractionBlock
          rawValue={field.rawValue}
          interpretedValue={field.interpretedValue}
          confidence={field.confidence}
          confidenceReason={field.confidenceReason}
          conflict={field.status === 'conflict' ? field.conflict : undefined}
        />

        {/* Actions */}
        {field.status === 'missing' && (
          <MissingActions
            field={field}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onConfirm={onConfirm}
          />
        )}
        {field.status === 'review' && (
          <ReviewActions
            field={field}
            editMode={editMode}
            inputValue={inputValue}
            onEditMode={setEditMode}
            onInputChange={setInputValue}
            onConfirm={onConfirm}
          />
        )}
        {field.status === 'conflict' && field.conflict && (
          <ConflictActions
            field={field}
            conflict={field.conflict}
            editMode={editMode}
            inputValue={inputValue}
            onEditMode={setEditMode}
            onInputChange={setInputValue}
            onConfirm={onConfirm}
          />
        )}
      </div>

      {/* Context strip — conflict only, full-width outside the padding */}
      {field.status === 'conflict' &&
        field.conflict?.context &&
        field.conflict.context.length > 0 && (
          <ContextStrip context={field.conflict.context} />
        )}
    </div>
  )
}
