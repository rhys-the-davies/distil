// Empty for generic Distil MVP — populate for schema-constrained deployments

export interface FieldDefinition {
  id: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'date' | 'enum'
  unit?: string
  enumValues?: string[]
}

export const FIELD_SCHEMA: FieldDefinition[] = []
// When empty, Claude extracts all recognisable fields from source files.
// When populated, Claude maps extracted values to the provided field IDs.
