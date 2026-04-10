import type { ColumnReview, Field } from '@/types/field'

/**
 * Check whether a value is empty (null, undefined,
 * empty string, or whitespace-only).
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

function applyFormatRule(
  value: unknown,
  rule: 'UPPERCASE' | 'lowercase' | 'Title Case'
): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (rule === 'UPPERCASE') return str.toUpperCase()
  if (rule === 'lowercase') return str.toLowerCase()
  // Title Case: capitalise first letter of each word
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * Apply a set of column reviews to a row array.
 * Returns a new row array. Original rows are never mutated.
 *
 * For each ColumnReview with status 'corrected':
 *   1. If formatRule is set, apply it to ALL cells in the column first.
 *   2. Apply each CellCorrection:
 *      - rowIndex === -1: apply correctedValue to every row in the column
 *      - rowIndex >= 0:   apply correctedValue to that specific row
 *      - rowIndex out of bounds: silently skip
 *
 * For each ColumnReview with status 'accepted':
 *   leave all values in that column unchanged
 */
export function applyCorrections(
  rows: Record<string, unknown>[],
  reviews: ColumnReview[]
): Record<string, unknown>[] {
  // Deep clone so originals are never mutated
  const result: Record<string, unknown>[] = rows.map(row => ({ ...row }))

  for (const review of reviews) {
    if (review.status === 'accepted') continue

    const { columnName, corrections, formatRule } = review

    // Step 1: apply formatRule to all cells in the column
    if (formatRule) {
      for (const row of result) {
        if (Object.prototype.hasOwnProperty.call(row, columnName)) {
          row[columnName] = applyFormatRule(row[columnName], formatRule)
        }
      }
    }

    // Step 2: apply per-cell corrections (and rowIndex: -1 sentinel)
    for (const correction of corrections) {
      const { rowIndex, correctedValue } = correction

      if (rowIndex === -1) {
        // Sentinel: apply to every row
        for (const row of result) {
          row[columnName] = correctedValue
        }
      } else if (rowIndex >= 0 && rowIndex < result.length) {
        result[rowIndex][columnName] = correctedValue
      }
      // out-of-bounds rowIndex: silently skip
    }
  }

  return result
}

/**
 * Convert a Field[] (extraction mode output) into row objects for CSV/JSON export.
 * Groups fields by recordIndex, sorts groups ascending, maps each group to
 * a { label: value } row object using resolvedValue > interpretedValue > rawValue.
 * Fields with no recordIndex are all placed in record 0.
 */
export function fieldsToRows(
  fields: Field[]
): Record<string, string>[] {
  const groups = new Map<number, Field[]>()
  for (const field of fields) {
    const idx = field.recordIndex ?? 0
    if (!groups.has(idx)) groups.set(idx, [])
    groups.get(idx)!.push(field)
  }
  const sorted = Array.from(groups.entries()).sort(([a], [b]) => a - b)
  return sorted.map(([, group]) => {
    const row: Record<string, string> = {}
    for (const field of group) {
      row[field.label] =
        field.resolvedValue ??
        field.interpretedValue ??
        field.rawValue ?? ''
    }
    return row
  })
}
