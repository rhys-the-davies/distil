import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import type { ExtractionPayload, Field } from '@/types/field'

function fieldValue(field: Field): string {
  return field.resolvedValue ?? field.interpretedValue ?? field.rawValue ?? ''
}

export async function POST(request: NextRequest) {
  let body: { payload?: ExtractionPayload; format?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { payload, format } = body
  if (!payload?.fields) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
  }
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'Invalid format — must be csv or json' },
      { status: 400 }
    )
  }

  const fields = payload.fields

  try {
    if (format === 'csv') {
      // One header row + one data row — field label → resolved value
      const row: Record<string, string> = {}
      for (const field of fields) {
        row[field.label] = fieldValue(field)
      }
      const csv = Papa.unparse([row])
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="distil-export.csv"',
        },
      })
    } else {
      // JSON: flat object keyed by field ID → resolved value
      const obj: Record<string, string> = {}
      for (const field of fields) {
        obj[field.id] = fieldValue(field)
      }
      const json = JSON.stringify(obj, null, 2)
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="distil-export.json"',
        },
      })
    }
  } catch (err) {
    console.error('[/api/download]', err)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
