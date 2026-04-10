import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getReviewPrompt } from '@/lib/prompts'
import { parseXlsx, type XlsxParseResult } from '@/lib/parsers/xlsx'
import { parseCsv, type CsvParseResult } from '@/lib/parsers/csv'
import { parseTxt, type WhatsAppParseResult, type PlainTextParseResult } from '@/lib/parsers/whatsapp'
import { FIELD_SCHEMA } from '@/lib/schema'
import type { ExtractionPayload, ExtractionSummary, Field } from '@/types/field'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.txt'])

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

// ── Prompt assembly ──────────────────────────────────────────────────────────

type ParseResult = XlsxParseResult | CsvParseResult | WhatsAppParseResult | PlainTextParseResult

function serializeXlsx(result: XlsxParseResult, filename: string): string {
  const parts: string[] = [`File: ${filename} (Excel Workbook)`]
  for (const sheet of result.sheets) {
    const cols = sheet.rows.length > 0 ? Object.keys(sheet.rows[0]) : []
    const header = cols.join(' | ')
    const rowLines = sheet.rows.map((row) =>
      cols.map((c) => String(row[c] ?? '')).join(' | ')
    )
    const truncNote =
      sheet.totalRows > sheet.rows.length
        ? `\n[Showing ${sheet.rows.length} of ${sheet.totalRows} rows]`
        : ''
    parts.push(
      `Sheet: ${sheet.name} (${sheet.totalRows} rows)\nColumns: ${header}\n${rowLines.join('\n')}${truncNote}`
    )
  }
  return parts.join('\n\n')
}

function serializeCsv(result: CsvParseResult, filename: string): string {
  const cols = result.headers
  const rowLines = result.rows.map((row) =>
    cols.map((c) => String(row[c] ?? '')).join(' | ')
  )
  const truncNote =
    result.totalRows > result.rows.length
      ? `\n[Showing ${result.rows.length} of ${result.totalRows} rows]`
      : ''
  return [
    `File: ${filename} (CSV)`,
    `Headers: ${cols.join(' | ')}`,
    rowLines.join('\n') + truncNote,
  ].join('\n')
}

function serializePlainText(result: PlainTextParseResult, filename: string): string {
  return [`File: ${filename} (Plain Text)`, result.content].join('\n')
}

function serializeWhatsApp(result: WhatsAppParseResult, filename: string): string {
  const lines = result.messages.map(
    (m) => `[${m.timestamp}] ${m.sender}: ${m.text}`
  )
  const truncNote =
    result.totalMessages > result.messages.length
      ? `\n[Showing ${result.messages.length} of ${result.totalMessages} messages]`
      : ''
  return [
    `File: ${filename} (WhatsApp Chat Export)`,
    `Messages: ${result.totalMessages} | Participants: ${result.participants.join(', ')}`,
    lines.join('\n') + truncNote,
  ].join('\n')
}

function buildUserPrompt(
  files: Array<{ filename: string; result: ParseResult }>,
  failures: Array<{ filename: string; error: string }>
): string {
  const sections: string[] = []

  for (const { filename, result } of files) {
    let block: string
    if (result.type === 'xlsx') block = serializeXlsx(result, filename)
    else if (result.type === 'csv') block = serializeCsv(result, filename)
    else if (result.type === 'whatsapp') block = serializeWhatsApp(result, filename)
    else block = serializePlainText(result, filename)
    sections.push(block)
  }

  if (failures.length > 0) {
    const failLines = failures.map(
      (f) => `  - ${f.filename}: ${f.error}`
    )
    sections.push(
      `[Note: The following files could not be parsed and are excluded:\n${failLines.join('\n')}]`
    )
  }

  const schemaNote =
    FIELD_SCHEMA.length > 0
      ? `\nField schema to map to:\n${JSON.stringify(FIELD_SCHEMA, null, 2)}`
      : '\n[No field schema provided — extract all recognisable fields freely.]'

  return sections.join('\n\n---\n\n') + '\n\n' + schemaNote
}

// ── Response validation ──────────────────────────────────────────────────────

function validateField(raw: unknown): Field | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || typeof f.label !== 'string') return null
  if (!['clean', 'review', 'conflict', 'missing'].includes(f.status as string)) return null
  if (!['high', 'medium', 'low', 'none'].includes(f.confidence as string)) return null

  // Merge required flag from FIELD_SCHEMA if applicable
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
    conflict: f.conflict as Field['conflict'] ?? undefined,
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Optional sessionId — unused in MVP, reserved for future persistence
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request — expected multipart form data' }, { status: 400 })
  }

  const uploaded = formData.getAll('files') as File[]
  if (uploaded.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  // Parse files
  const parsed: Array<{ filename: string; result: ParseResult }> = []
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
        parsed.push({ filename: file.name, result: parseXlsx(buffer) })
      } else if (ext === '.csv') {
        const text = new TextDecoder().decode(buffer)
        parsed.push({ filename: file.name, result: parseCsv(text) })
      } else {
        // .txt — WhatsApp export or plain text fallback
        const text = new TextDecoder().decode(buffer)
        parsed.push({ filename: file.name, result: parseTxt(text) })
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

  // Call Claude
  let fields: Field[]
  try {
    const systemPrompt = getReviewPrompt()
    const userPrompt = buildUserPrompt(parsed, failures)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const stripped = content.text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim()
    const json = JSON.parse(stripped) as { fields?: unknown[] }
    if (!Array.isArray(json.fields)) {
      throw new Error('Claude response missing "fields" array')
    }

    fields = json.fields
      .map(validateField)
      .filter((f): f is Field => f !== null)
  } catch (err) {
    console.error('[/api/extract] Claude error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }

  // Build summary
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
