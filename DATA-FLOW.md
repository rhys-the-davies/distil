# Distil — data flow

This document describes the four-layer architecture
and the mode-driven pipeline branching introduced in
the mode-picker feature. It is written for contributing
developers.

---

## Modes

Distil has two live modes, selected on the upload screen:

**Find issues** — the user has structured data and wants
to find and fix quality problems. Input: CSV and Excel.

**Structure** — the user has messy files and wants clean
structured output. Input: CSV, Excel, and plain text
(including WhatsApp exports).

The selected mode is stored in `lib/store.ts` and sent
as a `mode` field in the `/api/extract` form data.

---

## Mode-driven pipeline branching

```
/api/extract (thin route handler — app/api/extract/route.ts)
  → parseFiles()           shared: parses all files by extension
  → runObservationForAll() shared: Pass 0, Claude (lib/observation.ts)
  → if mode === 'find-issues':
      → lib/pipelines/find-issues.ts
         Pass 1: profiler (lib/profiler.ts)
         Pass 2: Claude interpretation (prompts/review.md)
         Returns: fields[], parsedRows, offendingCells, sampleRows
  → if mode === 'structure':
      → tabular files (CSV/XLSX):
         lib/pipelines/structure-tabular.ts
         Pass 1: profiler (same as find-issues)
         Pass 2: Claude normalisation (prompts/structure.md)
         Clean columns: generated directly from rows (no Claude)
         Returns: fields[] (no parsedRows)
         Row limit: 50 rows per file (explicit, never silent)
      → text files (TXT/WhatsApp):
         lib/pipelines/structure-text.ts
         Claude full extraction (prompts/structure.md)
         Returns: fields[] with recordIndex set by Claude
         Size limit: 40,000 chars (truncated with note)
```

**Key difference between modes:**
- Find issues produces `parsedRows` — the original rows are
  sent to the client and corrected on download.
- Structure produces `fields[]` with `recordIndex` — rows are
  derived from fields at export time via `fieldsToRows()`.

---

## The four layers

```
DETECTION      → lib/profiler.ts
                 Deterministic. Finds issues. No corrections.

INTERPRETATION → prompts/review.md + /api/extract
                 Claude only. Explains issues. No corrections.

RESOLUTION     → components/ColumnCard.tsx + review/page.tsx
                 User only. Decides corrections. No application.

CORRECTION     → lib/corrector.ts + /api/download
                 Deterministic. Applies corrections. No judgment.
```

Each layer has one job. No logic bleeds between them.
If you are looking for where something happens:

- A new quality check → `lib/profiler.ts`
- A new Claude explanation → `prompts/review.md`
- A new UI for resolving a flag → `components/ColumnCard.tsx`
- A new correction strategy → `lib/corrector.ts`

---

## End-to-end data flow

### 1. Upload

The user drops one or more CSV or Excel files.

`app/upload/page.tsx` generates a UUID session ID
(`crypto.randomUUID()`) and stores it in `lib/store.ts`.
The files are held in memory in `lib/store.ts` — never
written to disk at this point.

---

### 2. POST /api/extract

`app/processing/page.tsx` reads the files and session ID
from the store and POSTs them as multipart form data.

Inside the route (`app/api/extract/route.ts`):

**Parse**
Each file is routed by extension to `lib/parsers/xlsx.ts`
or `lib/parsers/csv.ts`. Parse failures are recorded
per file; the session continues with the remaining files.

**Store rows to /tmp**
Immediately after parsing — before any truncation —
the full row data is written to `/tmp/distil-[sessionId].json`.
Shape: `{ [filename]: rows[] }`. This is the source of
truth for the corrected export.

**Pass 0 — Observation (Claude)**
A lightweight Claude call (`prompts/observe.md`) receives
column headers and 3 sample rows per file. It returns a
`FileCharacterisation` describing the file type, domain,
column roles, and any relevant observations. Max 512 tokens.

**Pass 1 — Profiler (deterministic)**
`lib/profiler.ts` runs deterministic checks against the
parsed rows using the `FileCharacterisation` as context.
It produces a `ProfilerResult` per file: clean columns,
flagged columns, and a list of `ProfilerFlag` objects
describing each issue.

The profiler never modifies values. It only detects and
describes problems.

**Pass 2 — Interpretation (Claude)**
Claude receives the `FileCharacterisation` and the
`ProfilerResult` for each file — specifically the flagged
columns with their flag details. It does not receive the
full file content. It returns a `Field[]` describing each
flagged column with a plain-English `confidenceReason`.

Clean columns are converted to `Field` objects directly
in the route without Claude involvement.

All fields produced by this pipeline get `source: 'profiler'`
so the review screen can route them to `ColumnCard`.

**Offending cells**
For each flagged column, up to 10 representative offending
cells (with their `rowIndex`) are extracted and included
in the response as `ExtractionPayload.offendingCells`.
These are used by `ColumnCard` to populate its cell table.

The route returns the full `ExtractionPayload` including
`sampleRows` (first 3 rows per file, for the export preview)
and `offendingCells`.

---

### 3. Review (client)

`app/review/page.tsx` receives the `ExtractionPayload`
and splits the action-required fields by source:

- `source: 'profiler'` → `ColumnCard`
- `source: 'extraction'` or undefined → `FieldCard`

**ColumnCard** (`components/ColumnCard.tsx`) renders
flag-type-specific UI. The user either accepts the column
as-is or provides corrections. On resolution, it calls
`onResolve` with a `ColumnReview` object.

A `ColumnReview` contains:
- `status`: `'accepted'` or `'corrected'`
- `corrections`: an array of `CellCorrection` objects
- `formatRule` (optional): `'UPPERCASE'`, `'lowercase'`,
  or `'Title Case'` — used for capitalisation fixes

Two special correction patterns:
- `rowIndex: -1` sentinel — applies the `correctedValue`
  to every row in the column (used for entire-column fills)
- `formatRule` — applied by the corrector to all cells in
  the column before per-cell corrections are applied as
  overrides

All `ColumnReview` objects are held in React state in
`review/page.tsx`. When the user approves, they are saved
to `lib/store.ts` via `setColumnReviews()`.

---

### 4. POST /api/download

`app/export/page.tsx` sends `{ sessionId, format, reviews }`
to `/api/download`.

Inside the route (`app/api/download/route.ts`):

1. Read `storedData` from `/tmp/distil-[sessionId].json`.
   If not found, return 400 — the session has expired or
   the user must start over.

2. For each file, filter the reviews to that file and call
   `applyCorrections(rows, fileReviews)` from `lib/corrector.ts`.
   This returns a new row array — the originals are never
   mutated.

3. Preserve the original column order by using
   `Object.keys(rows[0])` from the parsed row objects.

4. Generate output:
   - Single file, CSV → `distil-[originalFilename]`
   - Multiple files, CSV → `distil-export.zip` (one CSV
     per file, via jszip)
   - JSON (any count) → `distil-export.json` as
     `[{ filename, rows[] }]`

5. Delete `/tmp/distil-[sessionId].json` after streaming.

---

## lib/corrector.ts

Pure functions only. No Claude, no UI, no store.

`applyCorrections(rows, reviews)` iterates the reviews
in order. For each `'corrected'` review:

1. If `formatRule` is set, apply the format to every cell
   in the column.
2. Apply each `CellCorrection`:
   - `rowIndex === -1` → apply to all rows
   - `rowIndex >= 0` → apply to that specific row
   - Out-of-bounds rowIndex → silently skip

`'accepted'` reviews leave the column unchanged.

The function always returns a new array. The input rows
are never mutated.

---

## Session ID lifecycle

| Event | Action |
|---|---|
| Upload screen mounts | `crypto.randomUUID()` → stored in `lib/store.ts` |
| POST /api/extract | `sessionId` validated (400 if missing), rows written to `/tmp` |
| POST /api/download | Rows read from `/tmp`, deleted after response |
| Start over | `clearAll()` resets the store including `sessionId` |
