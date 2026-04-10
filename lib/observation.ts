// Observation pass (Pass 0) — lightweight Claude call that characterises
// a structured file before the profiler and interpretation passes run.
// TXT/WhatsApp files are not profiled; their characterisation is set here.

import Anthropic from '@anthropic-ai/sdk'
import { getObservePrompt } from '@/lib/prompts'
import type { ParsedFile } from '@/lib/pipelines/types'
import type { FileCharacterisation } from '@/types/profiler'

async function observeFile(
  file: ParsedFile,
  client: Anthropic
): Promise<FileCharacterisation> {
  const headerLine = file.headers.join(' | ')
  const sampleLines = file.rows
    .slice(0, 3)
    .map((row) => file.headers.map((h) => String(row[h] ?? '')).join(' | '))
    .join('\n')

  const userMessage = [
    `File: ${file.filename}`,
    `Columns: ${file.headers.join(', ') || '(none)'}`,
    `Row count: ${file.totalRows}`,
    `Sample rows:`,
    headerLine,
    sampleLines,
  ].join('\n')

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

const FALLBACK: FileCharacterisation = {
  fileType: 'unknown',
  domain: 'unknown',
  primaryKeyColumn: null,
  columnRoles: {},
  notes: [],
}

/**
 * Run the observation pass for all parsed files.
 * TXT/WhatsApp files get a static characterisation — no Claude call needed.
 * Returns a map of filename → FileCharacterisation.
 */
export async function runObservationForAll(
  parsed: ParsedFile[],
  client: Anthropic
): Promise<Map<string, FileCharacterisation>> {
  const characterisations = new Map<string, FileCharacterisation>()

  for (const file of parsed) {
    const type = file.result.type

    if (type === 'plaintext' || type === 'whatsapp') {
      characterisations.set(file.filename, {
        ...FALLBACK,
        fileType: type === 'whatsapp' ? 'WhatsApp chat export' : 'plain text',
      })
      continue
    }

    try {
      const char = await observeFile(file, client)
      characterisations.set(file.filename, char)
      console.log(`[extract] Pass 0 — ${file.filename}: "${char.fileType}" (${char.domain})`)
    } catch (err) {
      console.error(`[extract] Pass 0 failed for ${file.filename}:`, err)
      characterisations.set(file.filename, FALLBACK)
    }
  }

  return characterisations
}
