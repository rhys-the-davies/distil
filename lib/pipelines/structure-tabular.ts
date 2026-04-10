// structure-tabular pipeline
// Processes CSV/XLSX files in Structure mode.
// Runs the profiler, sends ALL flagged column values to Claude for normalisation,
// generates clean column Fields directly from parsed rows.
// Returns Field[] with recordIndex set — no parsedRows.

import Anthropic from '@anthropic-ai/sdk'
import { getStructurePrompt } from '@/lib/prompts'
import { profileFile } from '@/lib/profiler'
import type { Field } from '@/types/field'
import type { FileCharacterisation, ProfilerResult } from '@/types/profiler'
import type { ParsedFile } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

const STRUCTURE_ROW_LIMIT = 50

// ── Helpers ───────────────────────────────────────────────────────────────────

function columnNameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Build the user message Claude receives for structure-tabular mode.
 * Flagged columns: all values with their row index.
 * Clean columns: name and data type only — Claude does not process them.
 */
function buildStructureTabularMessage(
  filename: string,
  rows: Record<string, unknown>[],
  profilerResult: ProfilerResult,
  characterisation: FileCharacterisation,
  totalFileRows: number,
  truncated: boolean
): string {
  const parts: string[] = []

  parts.push(`File: ${filename}`)
  parts.push(`Characterisation:\n${JSON.stringify(characterisation, null, 2)}`)
  parts.push(`Rows in this request: ${rows.length}`)

  if (truncated) {
    parts.push(
      `[Note: This file has ${totalFileRows} rows. Structure mode processed the first ${STRUCTURE_ROW_LIMIT} only.]`
    )
  }

  const { columns, flaggedColumns, cleanColumns } = profilerResult

  if (flaggedColumns.length > 0) {
    parts.push('\n### Flagged columns — extract and normalise ALL values:')
    parts.push('Return one Field per row for each flagged column.')
    parts.push('Use the row index shown here as recordIndex.\n')

    const flaggedCols = columns.filter((c) => flaggedColumns.includes(c.name))
    for (const col of flaggedCols) {
      parts.push(`Column: "${col.name}"`)
      parts.push(`DataType: ${col.dataType}`)
      parts.push(`Issues: ${col.flags.map((f) => f.type).join(', ')}`)
      parts.push('Values (rowIndex: value):')
      for (let i = 0; i < rows.length; i++) {
        const val = rows[i][col.name]
        const display =
          val === null || val === undefined ? '(empty)' : String(val)
        parts.push(`  ${i}: ${display}`)
      }
      parts.push('')
    }
  }

  if (cleanColumns.length > 0) {
    parts.push('### Clean columns — handled separately, do not return:')
    const cleanCols = columns.filter((c) => cleanColumns.includes(c.name))
    const summary = cleanCols.map((c) => `${c.name} (${c.dataType})`).join(', ')
    parts.push(summary)
  }

  return parts.join('\n')
}

/**
 * Validate a single Field object returned by Claude in structure mode.
 * Sets source: 'extraction'.
 */
function validateExtractionField(raw: unknown): Field | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || typeof f.label !== 'string') return null
  if (!['clean', 'review', 'missing'].includes(f.status as string)) return null
  if (!['high', 'medium', 'low', 'none'].includes(f.confidence as string)) return null

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
    required: false,
    recordIndex: typeof f.recordIndex === 'number' ? f.recordIndex : undefined,
    source: 'extraction',
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runStructureTabularPipeline(
  parsed: ParsedFile[],
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
  truncationNotes: string[]
}> {
  const allFields: Field[] = []
  const truncationNotes: string[] = []

  for (const file of parsed) {
    const characterisation = characterisations.get(file.filename) ?? {
      fileType: 'unknown',
      domain: 'unknown',
      primaryKeyColumn: null,
      columnRoles: {},
      notes: [],
    }

    // Apply 50-row limit — explicit, never silent
    const truncated = file.rows.length > STRUCTURE_ROW_LIMIT
    const rows = truncated ? file.rows.slice(0, STRUCTURE_ROW_LIMIT) : file.rows

    if (truncated) {
      const note =
        `Structure mode processed ${STRUCTURE_ROW_LIMIT} of ${file.rows.length} rows in ${file.filename} ` +
        `in this version. Upload a file with ${STRUCTURE_ROW_LIMIT} or fewer rows to extract all records.`
      truncationNotes.push(note)
      console.log(`[structure-tabular] ${file.filename}: truncated to ${STRUCTURE_ROW_LIMIT} of ${file.rows.length} rows`)
    }

    // Pass 1 — Profiler (run on truncated rows)
    const profilerResult: ProfilerResult = profileFile(rows, characterisation)
    console.log(
      `[structure-tabular] ${file.filename}: ` +
        `${profilerResult.cleanColumns.length} clean, ` +
        `${profilerResult.flaggedColumns.length} flagged columns`
    )

    // Pass 2 — Claude (flagged columns only, all values)
    let claudeFields: Field[] = []

    if (profilerResult.flaggedColumns.length > 0) {
      const userMessage = buildStructureTabularMessage(
        file.filename,
        rows,
        profilerResult,
        characterisation,
        file.rows.length,
        truncated
      )

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: getStructurePrompt(),
        messages: [{ role: 'user', content: userMessage }],
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
        .map(validateExtractionField)
        .filter((f): f is Field => f !== null)
    }

    // Step 3 — Clean columns: generate one Field per row directly
    const claudeFieldIds = new Set(claudeFields.map((f) => f.id))
    const cleanFields: Field[] = []

    for (const col of profilerResult.columns) {
      if (!profilerResult.cleanColumns.includes(col.name)) continue
      const id = columnNameToId(col.name)
      if (claudeFieldIds.has(id)) continue // already handled by Claude

      for (let i = 0; i < rows.length; i++) {
        const val = rows[i][col.name]
        const raw =
          val === null || val === undefined ? null : String(val)

        cleanFields.push({
          id,
          label: col.name,
          status: 'clean',
          confidence: 'high',
          confidenceReason: 'Column passed all profiler checks with no flags.',
          rawValue: raw,
          interpretedValue: raw,
          sourceFile: file.filename,
          sourceLocation: `row ${i}`,
          required: false,
          recordIndex: i,
          source: 'extraction',
        })
      }
    }

    allFields.push(...claudeFields, ...cleanFields)
  }

  // Surface any parse failures as a review field so the user is informed
  if (failures.length > 0) {
    allFields.push({
      id: '_parse_failures',
      label: 'Parse failures',
      status: 'review',
      confidence: 'none',
      confidenceReason: failures.map((f) => `${f.filename}: ${f.error}`).join('; '),
      rawValue: null,
      interpretedValue: null,
      sourceFile: null,
      sourceLocation: null,
      required: false,
      source: 'extraction',
    })
  }

  return { fields: allFields, truncationNotes }
}
