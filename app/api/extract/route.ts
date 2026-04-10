import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseXlsx } from '@/lib/parsers/xlsx'
import { parseCsv } from '@/lib/parsers/csv'
import { parseTxt } from '@/lib/parsers/whatsapp'
import { runObservationForAll } from '@/lib/observation'
import { runFindIssuesPipeline } from '@/lib/pipelines/find-issues'
import { runStructureTabularPipeline } from '@/lib/pipelines/structure-tabular'
import { runStructureTextPipeline } from '@/lib/pipelines/structure-text'
import type { ParsedFile } from '@/lib/pipelines/types'
import type { ExtractionPayload, ExtractionSummary, DistilMode } from '@/types/field'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function ext(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i === -1 ? '' : filename.slice(i).toLowerCase()
}

async function parseFiles(
  uploaded: File[],
  mode: DistilMode
): Promise<{ parsed: ParsedFile[]; failures: Array<{ filename: string; error: string }> }> {
  const parsed: ParsedFile[] = []
  const failures: Array<{ filename: string; error: string }> = []
  const SUPPORTED = new Set(['.xlsx', '.xls', '.csv', '.txt'])

  for (const file of uploaded) {
    const e = ext(file.name)
    if (!SUPPORTED.has(e)) {
      failures.push({ filename: file.name, error: 'Unsupported file type' })
      continue
    }
    if (e === '.txt' && mode !== 'structure') {
      failures.push({ filename: file.name, error: 'Plain text files require Structure mode.' })
      continue
    }
    try {
      const buf = await file.arrayBuffer()
      if (e === '.xlsx' || e === '.xls') {
        const result = parseXlsx(buf)
        const sheet = result.sheets[0]
        const headers = sheet?.rows.length > 0 ? Object.keys(sheet.rows[0]) : []
        const rows = result.sheets.flatMap((s) => s.rows)
        const totalRows = result.sheets.reduce((n, s) => n + s.totalRows, 0)
        parsed.push({ filename: file.name, rows, headers, totalRows, result })
      } else if (e === '.csv') {
        const result = parseCsv(new TextDecoder().decode(buf))
        parsed.push({ filename: file.name, rows: result.rows, headers: result.headers, totalRows: result.totalRows, result })
      } else {
        const result = parseTxt(new TextDecoder().decode(buf))
        const totalRows = result.type === 'whatsapp' ? result.totalMessages : 0
        parsed.push({ filename: file.name, rows: [], headers: [], totalRows, result })
      }
    } catch (err) {
      failures.push({ filename: file.name, error: err instanceof Error ? err.message : 'Parse error' })
    }
  }
  return { parsed, failures }
}

function buildSummary(fields: ExtractionPayload['fields'], parsed: ParsedFile[], extraWarnings = 0): ExtractionSummary {
  return {
    filesProcessed: parsed.length,
    fieldsExtracted: fields.length,
    fieldsConfident: fields.filter((f) => f.confidence === 'high').length,
    conflicts: fields.filter((f) => f.status === 'conflict').length,
    missingRequired: fields.filter((f) => f.status === 'missing' && f.required).length,
    warnings: fields.filter((f) => f.status === 'review').length + extraWarnings,
    totalRows: parsed.reduce((n, f) => n + f.totalRows, 0),
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Invalid request — expected multipart form data' }, { status: 400 }) }

  const mode = (formData.get('mode') as DistilMode | null) ?? 'find-issues'
  const uploaded = formData.getAll('files') as File[]
  if (uploaded.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const { parsed, failures } = await parseFiles(uploaded, mode)
  if (parsed.length === 0) return NextResponse.json({ error: 'All files failed to parse', failures }, { status: 422 })

  const characterisations = await runObservationForAll(parsed, client)
  const fileTypes = Object.fromEntries(parsed.map((p) => [p.filename, p.result.type]))

  let payload: ExtractionPayload
  try {
    if (mode === 'find-issues') {
      const r = await runFindIssuesPipeline(parsed, characterisations, failures, client)
      payload = { summary: buildSummary(r.fields, parsed), fields: r.fields, fileTypes, offendingCells: r.offendingCells, sampleRows: r.sampleRows, parsedRows: r.parsedRows }
    } else {
      const tabular = parsed.filter((f) => f.result.type === 'csv' || f.result.type === 'xlsx')
      const text = parsed.filter((f) => f.result.type === 'plaintext' || f.result.type === 'whatsapp')
      const [tr, txr] = await Promise.all([
        tabular.length > 0 ? runStructureTabularPipeline(tabular, characterisations, failures, client) : { fields: [], truncationNotes: [] },
        text.length > 0 ? runStructureTextPipeline(text, characterisations, failures, client) : { fields: [] },
      ])
      const fields = [...tr.fields, ...txr.fields]
      if (tr.truncationNotes.length > 0) console.log('[extract] Truncation notes:', tr.truncationNotes)
      payload = { summary: buildSummary(fields, parsed, tr.truncationNotes.length), fields, fileTypes }
    }
  } catch (err) {
    console.error('[/api/extract] Pipeline error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }

  console.log(JSON.stringify({ event: 'extraction_complete', mode, filesProcessed: parsed.length, totalRows: parsed.reduce((n, f) => n + f.rows.length, 0), fieldsExtracted: payload.fields.length, durationMs: Date.now() - startTime }))
  return NextResponse.json(payload)
}
