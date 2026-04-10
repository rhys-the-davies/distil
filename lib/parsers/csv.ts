// CSV parser — uses papaparse with header auto-detection

import Papa from 'papaparse'

export interface CsvParseResult {
  type: 'csv'
  headers: string[]
  rows: Record<string, unknown>[]
  totalRows: number
}

const MAX_ROWS = 200

export function parseCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const allRows = result.data
  const rows = allRows.slice(0, MAX_ROWS)

  return { type: 'csv', headers, rows, totalRows: allRows.length }
}
