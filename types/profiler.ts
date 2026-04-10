// types/profiler.ts

export interface FileCharacterisation {
  fileType: string            // e.g. "product catalogue", "supplier visit log"
  domain: string              // e.g. "retail", "manufacturing", "logistics"
  primaryKeyColumn: string | null  // column that uniquely identifies each row
  columnRoles: Record<string, string>  // e.g. { "Color": "variant", "Brand": "constant" }
  notes: string[]             // any observations relevant to profiling
}

export type ProfilerFlagType =
  | 'empty_cells'
  | 'placeholder_values'
  | 'entire_column_empty'
  | 'entire_column_placeholder'
  | 'capitalisation_inconsistency'
  | 'numeric_outlier'
  | 'mixed_types'
  | 'duplicate_rows'
  | 'truncated_values'

export interface ProfilerFlag {
  column: string
  type: ProfilerFlagType
  count: number
  total: number
  examples: string[]       // up to 3 example values
  detail: string           // plain-English description for Claude
}

export interface ColumnProfile {
  name: string
  role: string             // from FileCharacterisation.columnRoles
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'mixed'
  uniqueValues: number
  populatedCount: number
  totalCount: number
  sampleValues: string[]   // up to 5 representative values
  flags: ProfilerFlag[]
}

export interface ProfilerResult {
  characterisation: FileCharacterisation
  columns: ColumnProfile[]
  cleanColumns: string[]   // column names with no flags
  flaggedColumns: string[] // column names with one or more flags
  duplicateRowCount: number
}
