'use client'

import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ColumnReview, CellCorrection } from '@/types/field'
import type { ProfilerFlagType } from '@/types/profiler'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OffendingCell {
  rowIndex: number
  value: string
}

export interface ColumnCardProps {
  columnName: string
  flagType: ProfilerFlagType
  confidenceReason: string
  offendingCells: OffendingCell[]
  totalAffected: number
  totalRows: number
  sourceFile: string
  onResolve: (review: ColumnReview) => void
  onUnresolve: () => void
  resolution: ColumnReview | null
}

type FormatRule = 'UPPERCASE' | 'lowercase' | 'Title Case'

// ── Pure helpers ──────────────────────────────────────────────────────────────

function applyFormatRule(val: string, rule: FormatRule): string {
  if (rule === 'UPPERCASE') return val.toUpperCase()
  if (rule === 'lowercase') return val.toLowerCase()
  // Title Case
  return val.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function leftBorderColor(flagType: ProfilerFlagType, confirmed: boolean): string {
  if (confirmed) return 'var(--color-earth)'
  if (
    flagType === 'entire_column_empty' ||
    flagType === 'entire_column_placeholder'
  ) {
    return 'var(--color-scarlet)'
  }
  return 'rgba(41, 8, 0, 0.55)'
}

function flagTypeLabel(flagType: ProfilerFlagType): string {
  const map: Record<ProfilerFlagType, string> = {
    empty_cells: 'EMPTY CELLS',
    placeholder_values: 'PLACEHOLDER VALUES',
    entire_column_empty: 'ENTIRE COLUMN EMPTY',
    entire_column_placeholder: 'ENTIRE COLUMN PLACEHOLDER',
    capitalisation_inconsistency: 'CAPITALISATION',
    numeric_outlier: 'NUMERIC OUTLIER',
    mixed_types: 'MIXED TYPES',
    duplicate_rows: 'DUPLICATE ROWS',
    truncated_values: 'TRUNCATED VALUES',
  }
  return map[flagType]
}

function resolutionSummary(review: ColumnReview, totalRows: number): string {
  if (review.status === 'accepted') return 'Accepted as-is'
  const sentinel = review.corrections.find((c) => c.rowIndex === -1)
  if (sentinel) return `All ${totalRows} rows filled with "${sentinel.correctedValue}"`
  if (review.formatRule) {
    const n = review.corrections.length
    const base = `Standardised to ${review.formatRule}`
    return n > 0 ? `${base} · ${n} override${n !== 1 ? 's' : ''}` : base
  }
  const n = review.corrections.length
  return n > 0 ? `${n} cell${n !== 1 ? 's' : ''} corrected` : 'Accepted as-is'
}

// ── CellTable ─────────────────────────────────────────────────────────────────

interface CellTableProps {
  offendingCells: OffendingCell[]
  totalAffected: number
  cellInputs: Record<number, string>
  setCellInputs: Dispatch<SetStateAction<Record<number, string>>>
  correctionLabel: string
}

function CellTable({
  offendingCells,
  totalAffected,
  cellInputs,
  setCellInputs,
  correctionLabel,
}: CellTableProps) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: '5px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: 'var(--letter-spacing-label)',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  textAlign: 'left',
                  borderBottom: '0.5px solid var(--color-border-default)',
                  width: '52px',
                  whiteSpace: 'nowrap',
                }}
              >
                Row
              </th>
              <th
                style={{
                  padding: '5px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: 'var(--letter-spacing-label)',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  textAlign: 'left',
                  borderBottom: '0.5px solid var(--color-border-default)',
                }}
              >
                Current value
              </th>
              <th
                style={{
                  padding: '5px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: 'var(--letter-spacing-label)',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  textAlign: 'left',
                  borderBottom: '0.5px solid var(--color-border-default)',
                  minWidth: '160px',
                }}
              >
                {correctionLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {offendingCells.map(({ rowIndex, value }) => (
              <tr key={rowIndex}>
                <td
                  style={{
                    padding: '5px 8px',
                    borderBottom: '0.5px solid var(--color-border-default)',
                    color: 'var(--color-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    verticalAlign: 'middle',
                  }}
                >
                  {rowIndex + 1}
                </td>
                <td
                  style={{
                    padding: '5px 8px',
                    borderBottom: '0.5px solid var(--color-border-default)',
                    verticalAlign: 'middle',
                  }}
                >
                  {value !== '' ? (
                    <span className="mono" style={{ fontSize: '11px' }}>
                      {value}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      empty
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '4px 8px',
                    borderBottom: '0.5px solid var(--color-border-default)',
                    verticalAlign: 'middle',
                  }}
                >
                  <input
                    className="input"
                    type="text"
                    value={cellInputs[rowIndex] ?? ''}
                    onChange={(e) =>
                      setCellInputs((prev) => ({
                        ...prev,
                        [rowIndex]: e.target.value,
                      }))
                    }
                    placeholder="Leave blank to skip"
                    style={{ padding: '5px 8px', fontSize: '12px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalAffected > 10 && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            margin: '8px 0 0',
            lineHeight: 1.5,
          }}
        >
          Showing 10 of {totalAffected} affected cells. Your correction will
          apply to all {totalAffected} cells.
        </p>
      )}
    </div>
  )
}

// ── ColumnCard ────────────────────────────────────────────────────────────────

export default function ColumnCard({
  columnName,
  flagType,
  confidenceReason,
  offendingCells,
  totalAffected,
  totalRows,
  sourceFile,
  onResolve,
  onUnresolve,
  resolution,
}: ColumnCardProps) {
  // All hooks before any conditional returns
  const [cellInputs, setCellInputs] = useState<Record<number, string>>({})
  const [bulkInput, setBulkInput] = useState('')
  const [fillInput, setFillInput] = useState('')
  const [formatRule, setFormatRule] = useState<FormatRule | ''>('')

  const isConfirmed = resolution !== null
  const borderColor = leftBorderColor(flagType, isConfirmed)

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-white)',
    border: '0.5px solid var(--color-border-default)',
    borderLeft: `3px solid ${borderColor}`,
    borderRadius: `0 var(--radius-md) var(--radius-md) 0`,
    marginBottom: '8px',
    overflow: 'hidden',
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function resetInputs() {
    setCellInputs({})
    setBulkInput('')
    setFillInput('')
    setFormatRule('')
  }

  function handleAccept() {
    onResolve({
      sourceFile,
      columnName,
      status: 'accepted',
      corrections: [],
    })
  }

  function handleBulkApply() {
    const val = bulkInput.trim()
    if (!val) return
    const next: Record<number, string> = { ...cellInputs }
    for (const cell of offendingCells) next[cell.rowIndex] = val
    setCellInputs(next)
  }

  function handleFormatChange(rule: FormatRule) {
    setFormatRule(rule)
    // Auto-fill all cell inputs with the formatted value so the user can see
    // the result and optionally override individual cells
    const next: Record<number, string> = {}
    for (const cell of offendingCells) {
      next[cell.rowIndex] = applyFormatRule(cell.value, rule)
    }
    setCellInputs(next)
  }

  function buildCellCorrections(): CellCorrection[] {
    return offendingCells
      .filter(({ rowIndex }) => {
        const v = cellInputs[rowIndex]
        return v !== undefined && v.trim() !== ''
      })
      .map(({ rowIndex, value }) => ({
        sourceFile,
        columnName,
        rowIndex,
        originalValue: value,
        correctedValue: cellInputs[rowIndex].trim(),
      }))
  }

  // For capitalisation_inconsistency, cell inputs are
  // auto-filled when the user selects a format rule — this
  // gives the user visibility of what the format will
  // produce and the ability to override individual cells.
  // On confirm, only true overrides (cells where the user's
  // input differs from what the formatRule would produce)
  // become explicit CellCorrections. The formatRule itself
  // is stored on ColumnReview and applied by the corrector
  // to all cells in the column — so cells not in the
  // corrections array still get formatted correctly.
  function handleConfirmCorrections() {
    if (flagType === 'capitalisation_inconsistency' && formatRule) {
      // Only include cells where the user's input differs from what the
      // formatRule would produce — true overrides only
      const overrides: CellCorrection[] = offendingCells
        .filter(({ rowIndex, value }) => {
          const input = (cellInputs[rowIndex] ?? '').trim()
          return (
            input !== '' &&
            input !== applyFormatRule(value, formatRule as FormatRule)
          )
        })
        .map(({ rowIndex, value }) => ({
          sourceFile,
          columnName,
          rowIndex,
          originalValue: value,
          correctedValue: (cellInputs[rowIndex] ?? '').trim(),
        }))
      onResolve({
        sourceFile,
        columnName,
        status: 'corrected',
        corrections: overrides,
        formatRule: formatRule as FormatRule,
      })
    } else {
      onResolve({
        sourceFile,
        columnName,
        status: 'corrected',
        corrections: buildCellCorrections(),
      })
    }
  }

  // ── Confirmed (collapsed) view ────────────────────────────────────────────

  if (isConfirmed) {
    return (
      <div
        style={{
          ...cardStyle,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {columnName}
        </span>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          {resolutionSummary(resolution, totalRows)}
        </span>
        <button
          type="button"
          className="btn-tertiary"
          style={{ fontSize: '11px', flexShrink: 0 }}
          onClick={() => {
            resetInputs()
            onUnresolve()
          }}
        >
          Change
        </button>
      </div>
    )
  }

  // ── Shared card interior structure for unresolved states ──────────────────

  const isMissingFlag =
    flagType === 'entire_column_empty' ||
    flagType === 'entire_column_placeholder'

  const badgeClass = isMissingFlag ? 'badge badge-error' : 'badge badge-warning'

  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {columnName}
        </span>
        <span className={badgeClass}>{flagTypeLabel(flagType)}</span>
      </div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {sourceFile}
      </span>
    </div>
  )

  const confidence = (
    <p
      style={{
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        margin: '4px 0 16px',
        lineHeight: 1.6,
      }}
    >
      {confidenceReason}
    </p>
  )

  // ── entire_column_empty / entire_column_placeholder ───────────────────────

  if (
    flagType === 'entire_column_empty' ||
    flagType === 'entire_column_placeholder'
  ) {
    const canApply = fillInput.trim().length >= 2
    const description =
      flagType === 'entire_column_empty'
        ? 'All rows in this column are empty.'
        : 'All rows in this column contain placeholder values.'

    return (
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px' }}>
          {header}
          {confidence}
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {description} ({totalRows} rows total)
          </p>
          <div style={{ marginBottom: '12px' }}>
            <label className="label" style={{ marginBottom: '6px' }}>
              Fill all {totalRows} rows with
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                type="text"
                value={fillInput}
                onChange={(e) => setFillInput(e.target.value)}
                placeholder="Enter a value…"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canApply}
                onClick={() => {
                  onResolve({
                    sourceFile,
                    columnName,
                    status: 'corrected',
                    corrections: [
                      {
                        sourceFile,
                        columnName,
                        rowIndex: -1,
                        originalValue: '',
                        correctedValue: fillInput.trim(),
                      },
                    ],
                  })
                }}
                style={{ flexShrink: 0 }}
              >
                Apply corrections
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAccept}
            style={{ fontSize: '13px' }}
          >
            Accept as-is
          </button>
        </div>
      </div>
    )
  }

  // ── duplicate_rows — display-only for MVP ─────────────────────────────────

  if (flagType === 'duplicate_rows') {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px' }}>
          {header}
          {confidence}
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {totalAffected} duplicate row{totalAffected !== 1 ? 's' : ''}{' '}
            detected. Deduplication will be available in a future update.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAccept}
          >
            Accept as-is
          </button>
        </div>
      </div>
    )
  }

  // ── capitalisation_inconsistency ──────────────────────────────────────────

  if (flagType === 'capitalisation_inconsistency') {
    const canConfirm = formatRule !== ''
    const formatOptions: FormatRule[] = ['UPPERCASE', 'lowercase', 'Title Case']

    return (
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px' }}>
          {header}
          {confidence}

          <div style={{ marginBottom: '16px' }}>
            <label className="label" style={{ marginBottom: '8px' }}>
              Standardise all to
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {formatOptions.map((rule) => (
                <button
                  key={rule}
                  type="button"
                  onClick={() => handleFormatChange(rule)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    border: `1px solid ${
                      formatRule === rule
                        ? 'var(--color-earth)'
                        : 'var(--color-border-default)'
                    }`,
                    borderRadius: 'var(--radius-sm)',
                    background:
                      formatRule === rule
                        ? 'var(--color-earth)'
                        : 'var(--color-white)',
                    color:
                      formatRule === rule
                        ? 'var(--color-white)'
                        : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    transition: 'var(--transition-base)',
                  }}
                >
                  {rule}
                </button>
              ))}
            </div>
          </div>

          {offendingCells.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <CellTable
                offendingCells={offendingCells}
                totalAffected={totalAffected}
                cellInputs={cellInputs}
                setCellInputs={setCellInputs}
                correctionLabel="Override (optional)"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canConfirm}
              onClick={handleConfirmCorrections}
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAccept}
              style={{ fontSize: '13px' }}
            >
              Accept as-is
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── mixed_types — accept-as-is is primary ────────────────────────────────

  if (flagType === 'mixed_types') {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px' }}>
          {header}
          {confidence}
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              margin: '0 0 12px',
              lineHeight: 1.5,
            }}
          >
            Mixed types may be intentional. Review the cells below before
            deciding.
          </p>

          {offendingCells.length > 0 && (
            <CellTable
              offendingCells={offendingCells}
              totalAffected={totalAffected}
              cellInputs={cellInputs}
              setCellInputs={setCellInputs}
              correctionLabel="Correction (optional)"
            />
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAccept}
            >
              Accept as-is
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleConfirmCorrections}
              style={{ fontSize: '13px' }}
            >
              Confirm corrections
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Remaining cell-table variants ─────────────────────────────────────────
  // empty_cells, placeholder_values, numeric_outlier, truncated_values

  const bulkLabel =
    flagType === 'numeric_outlier'
      ? 'Replace all outliers with'
      : 'Fill affected cells with'

  return (
    <div style={cardStyle}>
      <div style={{ padding: '16px 20px' }}>
        {header}
        {confidence}

        {/* Bulk fill */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
            marginBottom: '16px',
          }}
        >
          <div style={{ flex: 1 }}>
            <label className="label" style={{ marginBottom: '6px' }}>
              {bulkLabel}
            </label>
            <input
              className="input"
              type="text"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Enter a value…"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={bulkInput.trim() === ''}
            onClick={handleBulkApply}
            style={{ flexShrink: 0, fontSize: '13px' }}
          >
            Apply
          </button>
        </div>

        {offendingCells.length > 0 && (
          <CellTable
            offendingCells={offendingCells}
            totalAffected={totalAffected}
            cellInputs={cellInputs}
            setCellInputs={setCellInputs}
            correctionLabel="Correction"
          />
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmCorrections}
          >
            Confirm corrections
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAccept}
            style={{ fontSize: '13px' }}
          >
            Accept as-is
          </button>
        </div>
      </div>
    </div>
  )
}
