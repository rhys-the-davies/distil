import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getReviewPrompt, getObservePrompt } from '@/lib/prompts'
import { parseXlsx, type XlsxParseResult } from '@/lib/parsers/xlsx'
import { parseCsv, type CsvParseResult } from '@/lib/parsers/csv'
import { profileFile } from '@/lib/profiler'
import { FIELD_SCHEMA } from '@/lib/schema'
import type { ExtractionPayload, ExtractionSummary, Field } from '@/types/field'
import type { FileCharacterisation, ProfilerResult, ColumnProfile } from '@/types/profiler'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

// ── Parsed file representation ────────────────────────────────────────────────

interface ParsedFile {
  filename: string
  rows: Record<string, unknown>[]   // flattened rows for the profiler
  headers: string[]                  // column headers for the observation pass
  totalRows: number                  // full row count (pre-truncation) for observation
  result: XlsxParseResult | CsvParseResult
}

// ── Pass 0 — Observation ──────────────────────────────────────────────────────

function buildObserveUserMessage(
  filename: string,
  headers: string[],
  totalRows: number,
  sampleRows: Record<string, unknown>[]
): string {
  const headerLine = headers.join(' | ')
  const sampleLines = sampleRows
    .map((row) => headers.map((h) => String(row[h] ?? '')).join(' | '))
    .join('\n')

  return [
    `File: ${filename}`,
    `Columns: ${headers.join(', ')}`,
    `Row count: ${totalRows}`,
    `Sample rows:`,
    headerLine,
    sampleLines,
  ].join('\n')
}

async function runObservationPass(file: ParsedFile): Promise<FileCharacterisation> {
  const userMessage = buildObserveUserMessage(
    file.filename,
    file.headers,
    file.totalRows,
    file.rows.slice(0, 3)
  )

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    system: getObservePrompt(),
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from observation pass')

  const stripped = content.text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim()

  return JSON.parse(stripped) as FileCharacterisation
}

// ── Pass 2 — Interpretation prompt ────────────────────────────────────────────

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
        parts.push(JSON.stringify({
          column: col.name,
          role: col.role,
          dataType: col.dataType,
          populatedCount: col.populatedCount,
          totalCount: col.totalCount,
          uniqueValues: col.uniqueValues,
          sampleValues: col.sampleValues,
          flags: col.flags,
        }, null, 2))
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
    parts.push(`[Note: The following files could not be parsed and are excluded:\n${failLines.join('\n')}]`)
  }

  const schemaNote = FIELD_SCHEMA.length > 0
    ? `\nField schema to map to:\n${JSON.stringify(FIELD_SCHEMA, null, 2)}`
    : '\n[No field schema provided — extract all recognisable fields freely.]'

  return parts.join('\n') + schemaNote
}

// ── Response validation ───────────────────────────────────────────────────────

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
  }
}

function columnToCleanField(col: ColumnProfile, filename: string): Field {
  const id = col.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
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
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Optional sessionId — unused in MVP, reserved for future persistence
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request — expected multipart form data' },
      { status: 400 }
    )
  }

  const uploaded = formData.getAll('files') as File[]
  if (uploaded.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  // ── Step 1: Parse ──────────────────────────────────────────────────────────

  const parsed: ParsedFile[] = []
  const failures: Array<{ filename: string; error: string }> = []

  for (const file of uploaded) {
    const ext = getExtension(file.name)

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      failures.push({ filename: file.name, error: 'Unsupported file type' })
      continue
    }

    try {
      const buffer = await file.arrayBuffer()

      if (ext === '.xlsx' || ext === '.xls') {
        const result = parseXlsx(buffer)
        const firstSheet = result.sheets[0]
        const headers = firstSheet?.rows.length > 0 ? Object.keys(firstSheet.rows[0]) : []
        const totalRows = result.sheets.reduce((n, s) => n + s.totalRows, 0)
        // Flatten all sheets — profiler handles the combined column set
        const rows = result.sheets.flatMap((s) => s.rows)
        parsed.push({ filename: file.name, rows, headers, totalRows, result })
      } else {
        const text = new TextDecoder().decode(buffer)
        const result = parseCsv(text)
        console.log(`[extract] ${file.name}: ${result.rows.length} rows parsed`)
        parsed.push({
          filename: file.name,
          rows: result.rows,
          headers: result.headers,
          totalRows: result.totalRows,
          result,
        })
      }
    } catch (err) {
      failures.push({
        filename: file.name,
        error: err instanceof Error ? err.message : 'Parse error',
      })
    }
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: 'All files failed to parse', failures },
      { status: 422 }
    )
  }

  // ── Step 2: Pass 0 — Observation (per file, Claude) ───────────────────────

  const characterisations = new Map<string, FileCharacterisation>()

  for (const file of parsed) {
    try {
      const char = await runObservationPass(file)
      characterisations.set(file.filename, char)
      console.log(`[extract] Pass 0 — ${file.filename}: "${char.fileType}" (${char.domain})`)
    } catch (err) {
      console.error(`[extract] Pass 0 failed for ${file.filename}:`, err)
      // Fallback: continue with a minimal characterisation rather than blocking the session
      characterisations.set(file.filename, {
        fileType: 'unknown',
        domain: 'unknown',
        primaryKeyColumn: null,
        columnRoles: {},
        notes: [],
      })
    }
  }

  // ── Step 3: Pass 1 — Profiler (per file, deterministic) ───────────────────

  const profilerResults: Array<{ filename: string; result: ProfilerResult }> = []

  for (const file of parsed) {
    const char = characterisations.get(file.filename)!
    const profilerResult = profileFile(file.rows, char)
    profilerResults.push({ filename: file.filename, result: profilerResult })
    console.log(
      `[extract] Pass 1 — ${file.filename}: ` +
      `${profilerResult.cleanColumns.length} clean, ` +
      `${profilerResult.flaggedColumns.length} flagged columns`
    )
  }

  // ── Step 4: Pass 2 — Interpretation (Claude, flagged columns only) ─────────

  let claudeFields: Field[]
  try {
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
  } catch (err) {
    console.error('[/api/extract] Claude error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }

  // ── Step 5: Merge — clean columns + Claude's flagged fields ───────────────

  // Claude's fields take precedence; only add clean-column fields Claude didn't cover
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

  // ── Step 6: Summary and response ──────────────────────────────────────────

  const summary: ExtractionSummary = {
    filesProcessed: parsed.length,
    fieldsExtracted: fields.length,
    fieldsConfident: fields.filter((f) => f.confidence === 'high').length,
    conflicts: fields.filter((f) => f.status === 'conflict').length,
    missingRequired: fields.filter((f) => f.status === 'missing' && f.required).length,
    warnings: fields.filter((f) => f.status === 'review').length,
  }

  const fileTypes: Record<string, string> = {}
  for (const { filename, result } of parsed) {
    fileTypes[filename] = result.type
  }

  const payload: ExtractionPayload = { summary, fields, fileTypes }
  return NextResponse.json(payload)
}
