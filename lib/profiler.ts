import type {
  FileCharacterisation,
  ProfilerResult,
  ColumnProfile,
  ProfilerFlag,
} from '@/types/profiler'
import {
  OUTLIER_STD_DEVIATIONS,
  MIN_CAPITALISATION_VARIANTS,
  PLACEHOLDER_VALUES,
} from './profiler-config'

type Row = Record<string, unknown>

// ── Value helpers ─────────────────────────────────────────────────────────────

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return PLACEHOLDER_VALUES.includes(value.trim().toLowerCase())
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

// ── Type inference ────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/

function inferType(value: unknown): 'string' | 'number' | 'date' | 'boolean' | 'empty' {
  if (isEmpty(value)) return 'empty'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (DATE_RE.test(trimmed)) return 'date'
    if (trimmed !== '' && !isNaN(Number(trimmed))) return 'number'
    return 'string'
  }
  return 'string'
}

function detectColumnDataType(values: unknown[]): ColumnProfile['dataType'] {
  const types = new Set<string>()
  for (const v of values) {
    const t = inferType(v)
    if (t !== 'empty') types.add(t)
  }
  if (types.size === 0) return 'string'
  if (types.size === 1) {
    const t = [...types][0]
    if (t === 'number') return 'number'
    if (t === 'date') return 'date'
    if (t === 'boolean') return 'boolean'
    return 'string'
  }
  return 'mixed'
}

// ── Statistics ────────────────────────────────────────────────────────────────

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// SD computed around a given centre (not necessarily the mean).
function stdDevAround(nums: number[], centre: number): number {
  const variance =
    nums.reduce((sum, n) => sum + Math.pow(n - centre, 2), 0) / nums.length
  return Math.sqrt(variance)
}

// ── Per-column checks ─────────────────────────────────────────────────────────

function checkEntireColumnEmpty(
  column: string,
  values: unknown[],
  total: number
): ProfilerFlag | null {
  if (!values.every(isEmpty)) return null
  return {
    column,
    type: 'entire_column_empty',
    count: total,
    total,
    examples: [],
    detail: 'Entire column is empty.',
  }
}

function checkEmptyCells(
  column: string,
  values: unknown[],
  total: number
): ProfilerFlag | null {
  const count = values.filter(isEmpty).length
  if (count === 0) return null
  return {
    column,
    type: 'empty_cells',
    count,
    total,
    examples: [],
    detail: `${count} of ${total} rows are empty.`,
  }
}

function checkPlaceholders(
  column: string,
  values: unknown[],
  total: number
): { partial: ProfilerFlag | null; entire: ProfilerFlag | null } {
  const matches = values.filter((v) => !isEmpty(v) && isPlaceholder(v))
  if (matches.length === 0) return { partial: null, entire: null }

  const examples = [...new Set(matches.map(toStr))].slice(0, 3)

  if (matches.length === total) {
    return {
      partial: null,
      entire: {
        column,
        type: 'entire_column_placeholder',
        count: total,
        total,
        examples,
        detail: 'Entire column contains placeholder values.',
      },
    }
  }

  return {
    partial: {
      column,
      type: 'placeholder_values',
      count: matches.length,
      total,
      examples,
      detail: `${matches.length} of ${total} rows contain placeholder values (e.g. ${examples[0] ?? 'N/A'}).`,
    },
    entire: null,
  }
}

function checkCapitalisationInconsistency(
  column: string,
  values: unknown[],
  total: number,
  dataType: ColumnProfile['dataType']
): ProfilerFlag | null {
  if (dataType !== 'string' && dataType !== 'mixed') return null

  const groups = new Map<string, Set<string>>()
  for (const v of values) {
    if (isEmpty(v) || typeof v !== 'string') continue
    const trimmed = v.trim()
    if (trimmed === '') continue
    const lower = trimmed.toLowerCase()
    if (!groups.has(lower)) groups.set(lower, new Set())
    groups.get(lower)!.add(trimmed)
  }

  const allVariants: string[] = []
  for (const [, variants] of groups) {
    if (variants.size >= MIN_CAPITALISATION_VARIANTS) {
      allVariants.push(...variants)
    }
  }

  if (allVariants.length === 0) return null

  const examples = allVariants.slice(0, 3)
  return {
    column,
    type: 'capitalisation_inconsistency',
    count: allVariants.length,
    total,
    examples,
    detail: `Capitalisation inconsistency: ${examples.join(', ')}${allVariants.length > 3 ? ', …' : ''}.`,
  }
}

function checkNumericOutliers(
  column: string,
  values: unknown[],
  total: number,
  dataType: ColumnProfile['dataType']
): ProfilerFlag[] {
  if (dataType !== 'number') return []

  const nums: number[] = []
  for (const v of values) {
    if (isEmpty(v)) continue
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    if (!isNaN(n)) nums.push(n)
  }

  if (nums.length < 2) return []

  // Use median as centre so that extreme outliers do not inflate the
  // reference point and mask themselves (the classic SD masking problem).
  const centre = median(nums)
  const sd = stdDevAround(nums, centre)
  if (sd === 0) return []

  const outlierValues = new Set<number>()
  for (const n of nums) {
    if (Math.abs(n - centre) > OUTLIER_STD_DEVIATIONS * sd) {
      outlierValues.add(n)
    }
  }

  return [...outlierValues].map((n) => ({
    column,
    type: 'numeric_outlier' as const,
    count: 1,
    total,
    examples: [String(n)],
    detail: `Numeric outlier: ${n} is more than ${OUTLIER_STD_DEVIATIONS} standard deviations from the column median (${centre.toFixed(2)}).`,
  }))
}

function checkMixedTypes(
  column: string,
  values: unknown[],
  total: number,
  dataType: ColumnProfile['dataType']
): ProfilerFlag | null {
  if (dataType !== 'mixed') return null

  const buckets: Record<string, string[]> = {}
  for (const v of values) {
    const t = inferType(v)
    if (t === 'empty') continue
    if (!buckets[t]) buckets[t] = []
    if (buckets[t].length < 2) buckets[t].push(toStr(v))
  }

  const typeList = Object.entries(buckets)
    .map(([t, samples]) => `${t} (e.g. ${samples.join(', ')})`)
    .join('; ')

  const examples = Object.values(buckets).flat().slice(0, 3)

  return {
    column,
    type: 'mixed_types',
    count: Object.keys(buckets).length,
    total,
    examples,
    detail: `Column contains mixed value types: ${typeList}.`,
  }
}

function checkTruncatedValues(
  column: string,
  values: unknown[],
  total: number
): ProfilerFlag | null {
  const truncated = values.filter(
    (v) => typeof v === 'string' && (v.trimEnd().endsWith('...') || v.trimEnd().endsWith('…'))
  )
  if (truncated.length === 0) return null

  const examples = [...new Set(truncated.map(toStr))].slice(0, 3)
  return {
    column,
    type: 'truncated_values',
    count: truncated.length,
    total,
    examples,
    detail: `${truncated.length} of ${total} rows contain truncated values ending in "..." or "…".`,
  }
}

// ── Duplicate row check ───────────────────────────────────────────────────────

function countDuplicateRows(rows: Row[]): number {
  const seen = new Map<string, number>()
  for (const row of rows) {
    const key = JSON.stringify(row)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let count = 0
  for (const n of seen.values()) {
    if (n > 1) count += n - 1
  }
  return count
}

// ── Main export ───────────────────────────────────────────────────────────────

export function profileFile(
  rows: Row[],
  characterisation: FileCharacterisation
): ProfilerResult {
  const total = rows.length
  const columnNames = total > 0 ? Object.keys(rows[0]) : []

  const columns: ColumnProfile[] = columnNames.map((colName) => {
    const values = rows.map((row) => row[colName])
    const dataType = detectColumnDataType(values)
    const role = characterisation.columnRoles[colName] ?? 'unknown'

    const sampleValues = values
      .filter((v) => !isEmpty(v))
      .map(toStr)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 5)

    const uniqueValues = new Set(
      values.filter((v) => !isEmpty(v)).map(toStr)
    ).size
    const populatedCount = values.filter((v) => !isEmpty(v)).length

    const flags: ProfilerFlag[] = []

    // Entire column empty takes precedence over partial empty
    const entireEmpty = checkEntireColumnEmpty(colName, values, total)
    if (entireEmpty) {
      flags.push(entireEmpty)
    } else {
      const partialEmpty = checkEmptyCells(colName, values, total)
      if (partialEmpty) flags.push(partialEmpty)
    }

    // Entire column placeholder takes precedence over partial
    const { partial: placeholderPartial, entire: placeholderEntire } =
      checkPlaceholders(colName, values, total)
    if (placeholderEntire) flags.push(placeholderEntire)
    else if (placeholderPartial) flags.push(placeholderPartial)

    const capFlag = checkCapitalisationInconsistency(colName, values, total, dataType)
    if (capFlag) flags.push(capFlag)

    flags.push(...checkNumericOutliers(colName, values, total, dataType))

    const mixedFlag = checkMixedTypes(colName, values, total, dataType)
    if (mixedFlag) flags.push(mixedFlag)

    const truncFlag = checkTruncatedValues(colName, values, total)
    if (truncFlag) flags.push(truncFlag)

    return {
      name: colName,
      role,
      dataType,
      uniqueValues,
      populatedCount,
      totalCount: total,
      sampleValues,
      flags,
    }
  })

  const cleanColumns = columns.filter((c) => c.flags.length === 0).map((c) => c.name)
  const flaggedColumns = columns.filter((c) => c.flags.length > 0).map((c) => c.name)
  const duplicateRowCount = countDuplicateRows(rows)

  return {
    characterisation,
    columns,
    cleanColumns,
    flaggedColumns,
    duplicateRowCount,
  }
}
