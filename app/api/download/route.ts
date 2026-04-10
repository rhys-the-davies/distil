import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { applyCorrections } from '@/lib/corrector'
import type { ColumnReview } from '@/types/field'

// ── /tmp helpers ──────────────────────────────────────────────────────────────

function readStoredRows(
  sessionId: string
): Record<string, Record<string, unknown>[]> {
  const path = join('/tmp', `distil-${sessionId}.json`)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function deleteStoredRows(sessionId: string): void {
  const path = join('/tmp', `distil-${sessionId}.json`)
  try {
    unlinkSync(path)
  } catch {
    // already gone — no action needed
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { sessionId?: unknown; format?: unknown; reviews?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sessionId, format, reviews: rawReviews } = body

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'Invalid format — must be csv or json' },
      { status: 400 }
    )
  }

  const reviews = Array.isArray(rawReviews) ? (rawReviews as ColumnReview[]) : []

  // Step 1: Read stored rows from /tmp
  let storedData: Record<string, Record<string, unknown>[]>
  try {
    storedData = readStoredRows(sessionId)
  } catch {
    return NextResponse.json(
      { error: 'Session data not found. Please start over.' },
      { status: 400 }
    )
  }

  try {
    // Step 2: Apply corrections per file
    const correctedFiles: Array<{
      filename: string
      rows: Record<string, unknown>[]
    }> = []

    for (const [filename, rows] of Object.entries(storedData)) {
      const fileReviews = reviews.filter((r) => r.sourceFile === filename)
      const corrected = applyCorrections(rows, fileReviews)
      correctedFiles.push({ filename, rows: corrected })
    }

    // Step 3 + 4: Produce output
    // Column order is preserved because Object.keys() returns keys in insertion
    // order, and the rows were parsed deterministically from the original file.

    if (format === 'json') {
      const json = JSON.stringify(correctedFiles, null, 2)
      deleteStoredRows(sessionId)
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
      // Derive headers from first row to preserve original column order
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      const csv = Papa.unparse({ fields: headers, data: rows })
      deleteStoredRows(sessionId)
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
      // Normalise to .csv extension regardless of original (.xlsx etc.)
      const csvName = filename.replace(/\.[^.]+$/, '.csv')
      zip.file(`distil-${csvName}`, csv)
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    deleteStoredRows(sessionId)
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="distil-export.zip"',
      },
    })
  } catch (err) {
    console.error('[/api/download]', err)
    deleteStoredRows(sessionId)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
