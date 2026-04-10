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
}

export interface ExtractionSummary {
  filesProcessed: number
  fieldsExtracted: number
  fieldsConfident: number
  conflicts: number
  missingRequired: number
  warnings: number
}

export interface ExtractionPayload {
  summary: ExtractionSummary
  fields: Field[]
  // filename → parse result type ('xlsx' | 'csv' | 'whatsapp' | 'plaintext')
  fileTypes: Record<string, string>
}
