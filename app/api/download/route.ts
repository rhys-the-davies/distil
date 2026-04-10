import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { applyCorrections, fieldsToRows } from '@/lib/corrector'
import type { ColumnReview, Field } from '@/types/field'

export async function POST(request: NextRequest) {
  let body: { parsedRows?: unknown; fields?: unknown; format?: unknown; reviews?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { parsedRows: rawParsedRows, fields: rawFields, format, reviews: rawReviews } = body

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'Invalid format — must be csv or json' },
      { status: 400 }
    )
  }

  const reviews = Array.isArray(rawReviews) ? (rawReviews as ColumnReview[]) : []

  try {
    let correctedFiles: Array<{ filename: string; rows: Record<string, unknown>[] }>

    // Find-issues path: parsedRows present → apply ColumnReview corrections
    if (
      rawParsedRows &&
      typeof rawParsedRows === 'object' &&
      !Array.isArray(rawParsedRows) &&
      Object.keys(rawParsedRows as object).length > 0
    ) {
      const storedData = rawParsedRows as Record<string, Record<string, unknown>[]>
      correctedFiles = Object.entries(storedData).map(([filename, rows]) => ({
        filename,
        rows: applyCorrections(rows, reviews.filter((r) => r.sourceFile === filename)),
      }))
    } else {
      // Structure mode path: derive rows from Field[] via fieldsToRows()
      const fields = Array.isArray(rawFields) ? (rawFields as Field[]) : []
      const rows = fieldsToRows(fields)
      correctedFiles = [{ filename: 'distil-export', rows }]
    }

    if (format === 'json') {
      const json = JSON.stringify(correctedFiles, null, 2)
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="distil-export.json"',
        },
      })
    }

    // CSV — single file
    if (correctedFiles.length === 1) {
      const { filename, rows } = correctedFiles[0]
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      const csv = Papa.unparse({ fields: headers, data: rows })
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="distil-${safeName}"`,
        },
      })
    }

    // CSV — multiple files: zip one CSV per file
    const zip = new JSZip()
    for (const { filename, rows } of correctedFiles) {
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      const csv = Papa.unparse({ fields: headers, data: rows })
      const csvName = filename.replace(/\.[^.]+$/, '.csv')
      zip.file(`distil-${csvName}`, csv)
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="distil-export.zip"',
      },
    })
  } catch (err) {
    console.error('[/api/download]', err)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
