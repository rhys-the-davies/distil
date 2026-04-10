// find-issues pipeline
// Runs profiler (Pass 1) + Claude interpretation (Pass 2) on CSV/XLSX files.
// Returns fields, parsedRows, offendingCells, and sampleRows.

import Anthropic from '@anthropic-ai/sdk'
import { getReviewPrompt } from '@/lib/prompts'
import { profileFile } from '@/lib/profiler'
import { FIELD_SCHEMA } from '@/lib/schema'
import {
  OUTLIER_STD_DEVIATIONS,
  MIN_CAPITALISATION_VARIANTS,
  PLACEHOLDER_VALUES,
} from '@/lib/profiler-config'
import type { ExtractionPayload, Field } from '@/types/field'
import type {
  FileCharacterisation,
  ProfilerResult,
  ColumnProfile,
  ProfilerFlagType,
} from '@/types/profiler'
import type { ParsedFile } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_RE =
  /^\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}/

function inferValueType(val: unknown): string {
  if (val === null || val === undefined) return 'empty'
  if (typeof val === 'boolean') return 'boolean'
  if (typeof val === 'number') return 'number'
  if (typeof val === 'string') {
    const t = val.trim()
    if (DATE_RE.test(t)) return 'date'
    if (t !== '' && !isNaN(Number(t))) return 'number'
    return 'string'
  }
  return 'string'
}

function extractOffendingCells(
  rows: Record<string, unknown>[],
  col: ColumnProfile,
  flagType: ProfilerFlagType
): Array<{ rowIndex: number; value: string }> {
  const MAX = 10
  const cells: Array<{ rowIndex: number; value: string }> = []
  const colName = col.name

  switch (flagType) {
    case 'empty_cells': {
      for (let i = 0; i < rows.length && cells.length < MAX; i++) {
        const val = rows[i][colName]
        if (
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '')
        ) {
          cells.push({ rowIndex: i, value: '' })
        }
      }
      break
    }

    case 'placeholder_values': {
      for (let i = 0; i < rows.length && cells.length < MAX; i++) {
        const val = rows[i][colName]
        if (
          typeof val === 'string' &&
          PLACEHOLDER_VALUES.includes(val.trim().toLowerCase())
        ) {
          cells.push({ rowIndex: i, value: val })
        }
      }
      break
    }

    case 'capitalisation_inconsistency': {
      const groups = new Map<string, Set<string>>()
      for (const row of rows) {
        const val = row[colName]
        if (!val || typeof val !== 'string') continue
        const trimmed = val.trim()
        if (!trimmed) continue
        const lower = trimmed.toLowerCase()
        if (!groups.has(lower)) groups.set(lower, new Set())
        groups.get(lower)!.add(trimmed)
      }
      const offending = new Set<string>()
      for (const [, variants] of groups) {
        if (variants.size >= MIN_CAPITALISATION_VARIANTS) {
          for (const v of variants) offending.add(v)
        }
      }
      for (let i = 0; i < rows.length && cells.length < MAX; i++) {
        const val = rows[i][colName]
        if (typeof val === 'string' && offending.has(val.trim())) {
          cells.push({ rowIndex: i, value: val })
        }
      }
      break
    }

    case 'numeric_outlier': {
      const nums: Array<{ rowIndex: number; value: number }> = []
      for (let i = 0; i < rows.length; i++) {
        const val = rows[i][colName]
        if (val === null || val === undefined) continue
        const n = typeof val === 'number' ? val : Number(String(val).trim())
        if (!isNaN(n)) nums.push({ rowIndex: i, value: n })
      }
      if (nums.length >= 2) {
        const sorted = [...nums.map((n) => n.value)].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const centre =
          sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid]
        const sd = Math.sqrt(
          sorted.reduce((sum, n) => sum + Math.pow(n - centre, 2), 0) /
            sorted.length
        )
        if (sd > 0) {
          for (const { rowIndex, value } of nums) {
            if (cells.length >= MAX) break
            if (Math.abs(value - centre) > OUTLIER_STD_DEVIATIONS * sd) {
              cells.push({ rowIndex, value: String(value) })
            }
          }
        }
      }
      break
    }

    case 'mixed_types': {
      const typeCounts = new Map<string, number>()
      for (const row of rows) {
        const t = inferValueType(row[colName])
        if (t !== 'empty') typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
      }
      let dominant = ''
      let maxCount = 0
      for (const [t, count] of typeCounts) {
        if (count > maxCount) {
          dominant = t
          maxCount = count
        }
      }
      for (let i = 0; i < rows.length && cells.length < MAX; i++) {
        const val = rows[i][colName]
        const t = inferValueType(val)
        if (t !== 'empty' && t !== dominant) {
          cells.push({ rowIndex: i, value: String(val) })
        }
      }
      break
    }

    case 'truncated_values': {
      for (let i = 0; i < rows.length && cells.length < MAX; i++) {
        const val = rows[i][colName]
        if (
          typeof val === 'string' &&
          (val.trimEnd().endsWith('...') || val.trimEnd().endsWith('…'))
        ) {
          cells.push({ rowIndex: i, value: val })
        }
      }
      break
    }

    // entire_column_empty, entire_column_placeholder, duplicate_rows:
    // ColumnCard shows a fill-all UI for these — no per-cell table needed
    default:
      break
  }

  return cells
}

function buildInterpretationUserMessage(
  profilerResults: Array<{ filename: string; result: ProfilerResult }>,
  failures: Array<{ filename: string; error: string }>
): string {
  const parts: string[] = []

  for (const { filename, result } of profilerResults) {
    const { characterisation, columns, cleanColumns, flaggedColumns, duplicateRowCount } = result

    parts.push(`## File: ${filename}`)
    parts.push(`Characterisation:\n${JSON.stringify(characterisation, null, 2)}`)

    if (duplicateRowCount > 0) {
      parts.push(`Duplicate rows detected: ${duplicateRowCount}`)
    }

    if (flaggedColumns.length > 0) {
      parts.push('\n### Flagged columns (interpret these):')
      const flagged = columns.filter((c) => flaggedColumns.includes(c.name))
      for (const col of flagged) {
        parts.push(
          JSON.stringify(
            {
              column: col.name,
              role: col.role,
              dataType: col.dataType,
              populatedCount: col.populatedCount,
              totalCount: col.totalCount,
              uniqueValues: col.uniqueValues,
              sampleValues: col.sampleValues,
              flags: col.flags,
            },
            null,
            2
          )
        )
      }
    }

    if (cleanColumns.length > 0) {
      parts.push('\n### Clean columns (no issues — names and samples only):')
      const clean = columns.filter((c) => cleanColumns.includes(c.name))
      for (const col of clean) {
        parts.push(`${col.name}: ${col.sampleValues.join(', ')}`)
      }
    }

    parts.push('')
  }

  if (failures.length > 0) {
    const failLines = failures.map((f) => `  - ${f.filename}: ${f.error}`)
    parts.push(
      `[Note: The following files could not be parsed and are excluded:\n${failLines.join('\n')}]`
    )
  }

  const schemaNote =
    FIELD_SCHEMA.length > 0
      ? `\nField schema to map to:\n${JSON.stringify(FIELD_SCHEMA, null, 2)}`
      : '\n[No field schema provided — extract all recognisable fields freely.]'

  return parts.join('\n') + schemaNote
}

function validateField(raw: unknown): Field | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || typeof f.label !== 'string') return null
  if (!['clean', 'review', 'conflict', 'missing'].includes(f.status as string)) return null
  if (!['high', 'medium', 'low', 'none'].includes(f.confidence as string)) return null

  const schemaDef = FIELD_SCHEMA.find((s) => s.id === f.id)

  return {
    id: f.id as string,
    label: f.label as string,
    status: f.status as Field['status'],
    confidence: f.confidence as Field['confidence'],
    confidenceReason: (f.confidenceReason as string | null) ?? null,
    rawValue: (f.rawValue as string | null) ?? null,
    interpretedValue: (f.interpretedValue as string | null) ?? null,
    sourceFile: (f.sourceFile as string | null) ?? null,
    sourceLocation: (f.sourceLocation as string | null) ?? null,
    required: schemaDef?.required ?? false,
    conflict: (f.conflict as Field['conflict']) ?? undefined,
    source: 'profiler',
  }
}

function columnToCleanField(col: ColumnProfile, filename: string): Field {
  const id = col.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  const schemaDef = FIELD_SCHEMA.find((s) => s.id === id)
  const firstSample = col.sampleValues[0] ?? null

  return {
    id,
    label: col.name,
    status: 'clean',
    confidence: 'high',
    confidenceReason: 'Column passed all profiler checks with no flags.',
    rawValue: firstSample,
    interpretedValue: firstSample,
    sourceFile: filename,
    sourceLocation: null,
    required: schemaDef?.required ?? false,
    source: 'profiler',
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runFindIssuesPipeline(
  parsed: ParsedFile[],
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
  parsedRows: Record<string, Record<string, unknown>[]>
  offendingCells: ExtractionPayload['offendingCells']
  sampleRows: ExtractionPayload['sampleRows']
}> {
  // Pass 1 — Profiler
  const profilerResults: Array<{ filename: string; result: ProfilerResult }> = []

  for (const file of parsed) {
    const char = characterisations.get(file.filename)!
    const profilerResult = profileFile(file.rows, char)
    profilerResults.push({ filename: file.filename, result: profilerResult })
    console.log(
      `[find-issues] Pass 1 — ${file.filename}: ` +
        `${profilerResult.cleanColumns.length} clean, ` +
        `${profilerResult.flaggedColumns.length} flagged columns`
    )
  }

  // Offending cells (up to 10 per flagged column)
  const offendingCells: ExtractionPayload['offendingCells'] = {}

  for (const { filename, result } of profilerResults) {
    const file = parsed.find((p) => p.filename === filename)!
    for (const col of result.columns) {
      if (col.flags.length === 0) continue
      const primaryFlag = col.flags[0]
      const cells = extractOffendingCells(file.rows, col, primaryFlag.type)
      if (cells.length > 0) {
        if (!offendingCells[filename]) offendingCells[filename] = {}
        offendingCells[filename][col.name] = cells
      }
    }
  }

  // Pass 2 — Claude interpretation (flagged columns only)
  let claudeFields: Field[]
  const userPrompt = buildInterpretationUserMessage(profilerResults, failures)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: getReviewPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const stripped = content.text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim()

  const json = JSON.parse(stripped) as { fields?: unknown[] }
  if (!Array.isArray(json.fields)) throw new Error('Claude response missing "fields" array')

  claudeFields = json.fields
    .map(validateField)
    .filter((f): f is Field => f !== null)

  // Enrich Claude fields with profiler metadata (flagType, totalAffected, totalRows)
  const colProfileLookup = new Map<string, ColumnProfile>()
  for (const { filename, result } of profilerResults) {
    for (const col of result.columns) {
      colProfileLookup.set(`${filename}::${col.name}`, col)
    }
  }

  for (const field of claudeFields) {
    if (!field.sourceFile || !field.label) continue
    const col = colProfileLookup.get(`${field.sourceFile}::${field.label}`)
    if (!col) continue
    const primaryFlag = col.flags[0]
    if (primaryFlag) {
      field.flagType = primaryFlag.type
      field.totalAffected = primaryFlag.count
    }
    field.totalRows = col.totalCount
  }

  // Merge — clean columns + Claude's flagged fields
  const claudeFieldIds = new Set(claudeFields.map((f) => f.id))
  const cleanFields: Field[] = []

  for (const { filename, result } of profilerResults) {
    for (const col of result.columns) {
      if (!result.cleanColumns.includes(col.name)) continue
      const field = columnToCleanField(col, filename)
      if (!claudeFieldIds.has(field.id)) {
        cleanFields.push(field)
      }
    }
  }

  const fields: Field[] = [...claudeFields, ...cleanFields]

  // parsedRows and sampleRows
  const parsedRows: Record<string, Record<string, unknown>[]> = {}
  const sampleRows: Record<string, Record<string, unknown>[]> = {}
  for (const file of parsed) {
    parsedRows[file.filename] = file.rows
    sampleRows[file.filename] = file.rows.slice(0, 5)
  }

  return { fields, parsedRows, offendingCells, sampleRows }
}
