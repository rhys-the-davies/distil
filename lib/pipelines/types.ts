// Shared types for pipeline functions.
// ParsedFile is the normalised in-memory representation after parsing,
// used as input to every pipeline and to the observation pass.

import type { XlsxParseResult } from '@/lib/parsers/xlsx'
import type { CsvParseResult } from '@/lib/parsers/csv'
import type { TxtParseResult } from '@/lib/parsers/whatsapp'

export interface ParsedFile {
  filename: string
  rows: Record<string, unknown>[]    // flattened rows — empty for TXT files
  headers: string[]                   // column headers — empty for TXT files
  totalRows: number                   // full row count before any truncation
  result: XlsxParseResult | CsvParseResult | TxtParseResult
}
