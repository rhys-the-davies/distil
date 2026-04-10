// structure-text pipeline
// Processes TXT and WhatsApp files in Structure mode.
// Sends raw file content to Claude for full extraction.
// Returns Field[] with recordIndex assigned by Claude.

import Anthropic from '@anthropic-ai/sdk'
import { getStructurePrompt } from '@/lib/prompts'
import type { Field } from '@/types/field'
import type { FileCharacterisation } from '@/types/profiler'
import type { ParsedFile } from './types'
import type { WhatsAppParseResult, PlainTextParseResult } from '@/lib/parsers/whatsapp'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONTENT_CHARS = 40_000

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Serialise a TXT parse result to a string Claude can read.
 * Includes a file header and the FileCharacterisation as context.
 */
function serialiseContent(
  filename: string,
  result: WhatsAppParseResult | PlainTextParseResult,
  characterisation: FileCharacterisation
): string {
  const parts: string[] = []

  parts.push(`File: ${filename}`)
  parts.push(`Characterisation:\n${JSON.stringify(characterisation, null, 2)}`)
  parts.push('')

  if (result.type === 'whatsapp') {
    parts.push(`Type: WhatsApp export`)
    parts.push(`Total messages: ${result.totalMessages}`)
    parts.push(`Participants: ${result.participants.join(', ')}`)
    parts.push('')
    parts.push('Messages:')
    for (const msg of result.messages) {
      parts.push(`[${msg.timestamp}] ${msg.sender}: ${msg.text}`)
    }
  } else {
    parts.push('Type: Plain text')
    parts.push('')
    parts.push('Content:')
    parts.push(result.content)
  }

  return parts.join('\n')
}

/**
 * Validate a single Field object returned by Claude in structure/text mode.
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

export async function runStructureTextPipeline(
  parsed: ParsedFile[],
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
}> {
  const allFields: Field[] = []

  for (const file of parsed) {
    const txtResult = file.result as WhatsAppParseResult | PlainTextParseResult
    const characterisation = characterisations.get(file.filename) ?? {
      fileType: 'unknown',
      domain: 'unknown',
      primaryKeyColumn: null,
      columnRoles: {},
      notes: [],
    }

    // Step 1 — Serialise
    let serialised = serialiseContent(file.filename, txtResult, characterisation)

    // Size guard — enforce even though DropZone already limits 50KB
    if (serialised.length > MAX_CONTENT_CHARS) {
      serialised =
        serialised.slice(0, MAX_CONTENT_CHARS) +
        '\n[Content truncated at 40,000 characters. Extract from the content above only.]'
      console.log(
        `[structure-text] ${file.filename}: content truncated to ${MAX_CONTENT_CHARS} chars`
      )
    }

    // Step 2 — Claude full extraction
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: getStructurePrompt(),
      messages: [{ role: 'user', content: serialised }],
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

    const fields = json.fields
      .map(validateExtractionField)
      .filter((f): f is Field => f !== null)

    allFields.push(...fields)
  }

  // Surface any parse failures as a review field
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

  return { fields: allFields }
}
