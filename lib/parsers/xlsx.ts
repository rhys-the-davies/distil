// Excel parser — uses the xlsx package
// Extracts all sheets as arrays of row objects

import * as XLSX from 'xlsx'

export interface ParsedSheet {
  name: string
  rows: Record<string, unknown>[]
  totalRows: number
}

export interface XlsxParseResult {
  type: 'xlsx'
  sheets: ParsedSheet[]
}

const MAX_ROWS_PER_SHEET = 200
const MAX_COLS = 30

export function parseXlsx(buffer: ArrayBuffer): XlsxParseResult {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })

  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      blankrows: false,
    })

    // Cap columns per row to avoid runaway token counts
    const trimmedRows = allRows.slice(0, MAX_ROWS_PER_SHEET).map((row) => {
      const entries = Object.entries(row).slice(0, MAX_COLS)
      return Object.fromEntries(entries)
    })

    return {
      name,
      rows: trimmedRows,
      totalRows: allRows.length,
    }
  })

  return { type: 'xlsx', sheets }
}
