export type FieldStatus = 'clean' | 'review' | 'conflict' | 'missing'
export type FieldConfidence = 'high' | 'medium' | 'low' | 'none'

export interface ConflictSource {
  file: string
  location: string
  value: string
  date: string
}

export interface ContextMessage {
  who: string
  text: string
  highlight: boolean
}

export interface FieldConflict {
  sources: ConflictSource[]
  defaultSource: number
  context: ContextMessage[]
}

export interface Field {
  id: string
  label: string
  status: FieldStatus
  confidence: FieldConfidence
  confidenceReason: string | null
  rawValue: string | null
  interpretedValue: string | null
  sourceFile: string | null
  sourceLocation: string | null
  required: boolean
  conflict?: FieldConflict
  resolvedValue?: string     // set client-side when user confirms a value
  resolvedSource?: string    // set client-side when user confirms a source
  source?: 'profiler' | 'extraction'
  // Set only when source === 'profiler' — drives ColumnCard rendering
  flagType?: import('@/types/profiler').ProfilerFlagType
  totalAffected?: number
  totalRows?: number
}

export interface ExtractionSummary {
  filesProcessed: number
  fieldsExtracted: number
  fieldsConfident: number
  conflicts: number
  missingRequired: number
  warnings: number
  totalRows: number  // sum of row counts across all parsed files
}

export interface ExtractionPayload {
  summary: ExtractionSummary
  fields: Field[]
  // filename → parse result type ('xlsx' | 'csv' | 'whatsapp' | 'plaintext')
  fileTypes: Record<string, string>
  // First 3 rows per file — used client-side for the export preview
  sampleRows?: {
    [filename: string]: Record<string, unknown>[]
  }
  offendingCells?: {
    [filename: string]: {
      [columnName: string]: Array<{
        rowIndex: number
        value: string
      }>
    }
  }
  parsedRows?: {
    [filename: string]: Record<string, unknown>[]
  }
}

/**
 * A single cell-level correction.
 * rowIndex is zero-based and positional — stable for
 * deterministically parsed CSV/XLSX files.
 * rowIndex: -1 is a sentinel meaning "apply to all rows in this column".
 */
export interface CellCorrection {
  sourceFile: string     // must match filename exactly
  columnName: string     // must match original header exactly
  rowIndex: number       // zero-based index in parsed row array; -1 = all rows
  originalValue: string  // the value being replaced
  correctedValue: string // the replacement value
}

/**
 * The resolution a user made for one flagged column.
 * Produced by ColumnCard, consumed by the corrector.
 */
export interface ColumnReview {
  sourceFile: string
  columnName: string
  status: 'accepted' | 'corrected'
  corrections: CellCorrection[]  // empty when status is 'accepted'
  formatRule?: 'UPPERCASE' | 'lowercase' | 'Title Case'
  // When set, corrector applies this format to ALL cells in the column
  // first, then applies per-cell corrections as overrides
}
