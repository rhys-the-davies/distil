# Distil — structured export spec
## Branch: feature/structured-export

Read this document completely before writing any code.
Also read mvp-spec.md for full application context.
This document specifies additive changes only — do not
modify anything not mentioned here.

---

## Architectural overview

This spec implements Answer B for structured file export:
the output is a corrected version of the original file
with all rows, with user-defined corrections applied to
specific cells.

The pipeline has four clean layers. Keep them separate —
no logic should bleed between layers:

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

A contributing developer should be able to read this
separation and immediately understand where to look for
any piece of logic.

---

## Data flow

```
1. Upload files
   → generate sessionId (UUID) in browser
   → pass sessionId with every API request

2. /api/extract
   → parse files → write full rows to /tmp/[sessionId].json
   → Pass 0: observation (Claude)
   → Pass 1: profiler (deterministic)
   → Pass 2: interpretation (Claude, flagged columns only)
   → return ExtractionPayload to client

3. Review screen (client)
   → render ColumnCard for each flagged column
   → user resolves issues → produces ColumnReview[]
   → store ColumnReview[] in React state

4. /api/download
   → receive ColumnReview[] + sessionId + format
   → read full rows from /tmp/[sessionId].json
   → apply corrections via lib/corrector.ts
   → stream corrected file(s) as download

5. Cleanup
   → delete /tmp/[sessionId].json after download
```

---

## 1. Session ID

Generate a UUID in the browser at upload time. Pass it
as `sessionId` in the form data of every API request.

```typescript
// In app/upload/page.tsx, generate on mount:
const sessionId = crypto.randomUUID()
// Store in React state, pass with every fetch
```

This is the `sessionId` already reserved in the spec
for future persistence. Used here for /tmp file
management.

---

## 2. Server-side row storage via /tmp

In `/api/extract/route.ts`, after parsing each file and
before the observation pass, write the full row data to
/tmp. Store ALL rows — before any truncation the profiler
applies. The stored rows are the source of truth for
export and must be complete.

```typescript
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'

function storeRows(
  sessionId: string,
  data: Record<string, Record<string, unknown>[]>
): void {
  const path = join('/tmp', `distil-${sessionId}.json`)
  writeFileSync(path, JSON.stringify(data), 'utf-8')
}

function readStoredRows(
  sessionId: string
): Record<string, Record<string, unknown>[]> {
  const path = join('/tmp', `distil-${sessionId}.json`)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function deleteStoredRows(sessionId: string): void {
  const path = join('/tmp', `distil-${sessionId}.json`)
  try { unlinkSync(path) } catch { /* already gone */ }
}
```

Stored data shape: `{ [filename]: rows[] }` — one entry
per uploaded file.

---

## 3. New types: CellCorrection and ColumnReview

Add to `types/field.ts` alongside existing types.
Do not modify existing types.

```typescript
// types/field.ts — add these exports

/**
 * A single cell-level correction.
 * rowIndex is zero-based and positional — stable for
 * deterministically parsed CSV/XLSX files.
 */
export interface CellCorrection {
  sourceFile: string     // must match filename exactly
  columnName: string     // must match original header exactly
  rowIndex: number       // zero-based index in the parsed row array
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
}
```

Also add `source` to the existing `Field` interface:

```typescript
// Add to existing Field interface in types/field.ts
source?: 'profiler' | 'extraction'
```

And extend `ExtractionPayload` with offending cells
for display in `ColumnCard`:

```typescript
// Add to existing ExtractionPayload in types/field.ts
offendingCells?: {
  [filename: string]: {
    [columnName: string]: Array<{
      rowIndex: number
      value: string
    }>
  }
}
```

Store up to 10 offending cells per column — enough for
the ColumnCard display. The corrector does not use this
data; it scans the full row array directly.

---

## 4. New file: lib/corrector.ts

The correction engine. Pure functions only. No Claude,
no UI, no store. Data in, corrected data out.

Write unit tests alongside it in `lib/corrector.test.ts`.

```typescript
// lib/corrector.ts

import type { ColumnReview, CellCorrection } from '@/types/field'

/**
 * Apply a set of column reviews to a row array.
 * Returns a new row array. Original rows are never mutated.
 *
 * For each ColumnReview with status 'corrected':
 *   apply each CellCorrection to rows[rowIndex][columnName]
 *
 * For each ColumnReview with status 'accepted':
 *   leave all values in that column unchanged
 */
export function applyCorrections(
  rows: Record<string, unknown>[],
  reviews: ColumnReview[]
): Record<string, unknown>[]

/**
 * Check whether a value is empty (null, undefined,
 * empty string, or whitespace-only).
 */
export function isEmpty(value: unknown): boolean
```

### Unit tests required (lib/corrector.test.ts)

All tests must pass before proceeding to step 4.

- `accepted` review leaves all values in that column unchanged
- `corrected` review applies corrections at the correct row indices
- Corrections do not affect other columns
- Corrections do not affect rows not in the corrections array
- Original row array is not mutated (verify with deep equality)
- Empty reviews array returns rows unchanged
- Multiple reviews on different columns both apply correctly
- A column with zero corrections in a `corrected` review
  leaves that column unchanged
- rowIndex out of bounds is silently skipped (defensive)

---

## 5. New component: ColumnCard

Create `components/ColumnCard.tsx`.

Do not modify `FieldCard`. `ColumnCard` is exclusively
for structured file column-level quality flags.

### Props

```typescript
interface ColumnCardProps {
  columnName: string
  flagType: ProfilerFlagType
  confidenceReason: string       // from Claude's Pass 2
  offendingCells: Array<{        // from ExtractionPayload.offendingCells
    rowIndex: number
    value: string
  }>
  totalAffected: number          // total count from profiler flag
  totalRows: number
  sourceFile: string
  onResolve: (review: ColumnReview) => void
  onUnresolve: () => void
  resolution: ColumnReview | null
}
```

### Offending cells display

Show up to 10 offending cells in a table inside the card.
Columns: Row number (rowIndex + 1), Current value,
Correction input.

If totalAffected > 10, show below the table:
"Showing 10 of [totalAffected] affected cells.
Your correction will apply to all [totalAffected] cells."

Bulk action at the top of the table: an input or
dropdown that fills all correction inputs at once.
Individual cells can be overridden after bulk fill.

### Resolution UX by flag type

**entire_column_empty or entire_column_placeholder:**
No cell table — entire column is affected.
Input: "Fill all [N] rows with:" + Apply button
(disabled until 2+ characters entered).
"Accept as-is" secondary button.

When Apply is clicked, generate one `CellCorrection`
per row in the full dataset (not just the 10 displayed).
The ColumnCard does not have access to the full row
array — generate placeholders with rowIndex 0 to N-1
and `originalValue: ''`. The corrector will apply to
all rows regardless, since every cell is affected.

Actually simpler: for entire_column flags, use a single
sentinel CellCorrection with rowIndex: -1 to signal
"apply to all rows in this column." The corrector checks
for rowIndex === -1 and applies to every row.

```typescript
// Sentinel for entire-column corrections
const sentinelCorrection: CellCorrection = {
  sourceFile,
  columnName,
  rowIndex: -1,       // sentinel: apply to all rows
  originalValue: '',
  correctedValue: fillValue
}
```

Update `applyCorrections` in `lib/corrector.ts` to
handle the rowIndex: -1 sentinel.

**capitalisation_inconsistency:**
Cell table showing up to 10 offending cells.
Bulk dropdown at top: "Standardise all to:"
Options: UPPERCASE / lowercase / Title Case.
Selecting fills all correction inputs accordingly.
Individual cells can be overridden.
"Accept as-is" secondary button.

When confirmed, generate one `CellCorrection` per
offending cell shown, plus apply the chosen format to
any additional cells beyond the 10 displayed. Use a
second sentinel: store the format choice as a special
correctedValue prefix `__format:UPPERCASE__` and let
the corrector detect and apply it.

Simpler alternative: for capitalisation flags, store
the format choice separately and have the corrector
apply it by scanning all rows for non-conforming values.
Add a `formatRule` optional field to `ColumnReview`:

```typescript
export interface ColumnReview {
  sourceFile: string
  columnName: string
  status: 'accepted' | 'corrected'
  corrections: CellCorrection[]
  formatRule?: 'UPPERCASE' | 'lowercase' | 'Title Case'
  // When set, corrector applies this format to ALL cells
  // in the column regardless of corrections array
}
```

Update `applyCorrections` to apply `formatRule` first
if present, then apply per-cell `corrections` as
overrides.

**numeric_outlier:**
Cell table showing outlier cells.
Input per cell: replacement value.
Bulk input at top: "Replace all outliers with:" + Apply.
"Accept as-is" secondary button.

**mixed_types:**
Cell table showing non-dominant-type cells.
"Accept as-is" is the default — make it the primary
button with explanation: "Mixed types may be intentional."
Input per cell for correction.

**empty_cells or placeholder_values (partial):**
Cell table showing up to 10 affected cells.
Bulk input: "Fill affected cells with:" + Apply.
Individual overrides allowed.
"Accept as-is" secondary button.

**duplicate_rows:**
Show pairs of duplicate rows (up to 5 pairs).
For each pair: "Keep first" / "Keep second" buttons.
Bulk: "Keep first occurrence of all duplicates."
Store as CellCorrections where the removed row gets
correctedValue: `__remove__` and the corrector skips
that row in the output.

Wait — row removal contradicts the spec principle of
never deleting rows. For duplicates in MVP: surface
them, allow "Accept as-is", defer actual deduplication
to backlog. Mark duplicate_rows as display-only for now.

### Confirmed state

Collapses to single row: column name + brief resolution
description + "Change" link. "Change" fully restores
unresolved state.

### Left border colours

- MISSING flag types (entire_column_empty,
  entire_column_placeholder): Scarlet
- NEEDS REVIEW flag types (all others): Earth at 55%
- Confirmed: Earth at full opacity

---

## 6. Updated: /api/extract/route.ts

Four changes:

**a) Accept and validate sessionId**
If missing, return 400.

**b) Store full rows to /tmp before truncation**
Immediately after parsing, before profiler truncation,
call `storeRows(sessionId, allParsedData)`.

**c) Extract and return offending cells**
After the profiler pass, for each flagged column extract
up to 10 offending cells from the full parsed rows.
Include in the response as `offendingCells`.

**d) Set source: 'profiler' on produced fields**
Fields from `columnToCleanField()` and from Claude's
Pass 2 for structured files get `source: 'profiler'`.

---

## 7. Updated: review/page.tsx

**State:**
```typescript
const [fields, setFields] = useState<Field[]>([])
const [reviews, setReviews] = useState<ColumnReview[]>([])
```

**Rendering:**
`source: 'profiler'` → `ColumnCard`
`source: 'extraction'` or undefined → `FieldCard`

**Resolution handlers:**
```typescript
function handleResolve(review: ColumnReview) {
  setReviews(prev => [
    ...prev.filter(r =>
      !(r.sourceFile === review.sourceFile &&
        r.columnName === review.columnName)
    ),
    review
  ])
}

function handleUnresolve(sourceFile: string, columnName: string) {
  setReviews(prev => prev.filter(r =>
    !(r.sourceFile === sourceFile && r.columnName === columnName)
  ))
}
```

**Approve enabled when:**
Every profiler field has a matching `ColumnReview`.
Every extraction field has a `resolvedValue`.

**On approve:**
Store `reviews` in lib/store alongside existing payload.
Navigate to /export.

**Remove:**
Feedback textarea and "Re-run review — coming soon"
button. Remove entirely. No placeholder.

---

## 8. Updated: lib/store.ts

Add reviews storage:

```typescript
let columnReviewStore: ColumnReview[] = []

export function setColumnReviews(reviews: ColumnReview[]): void {
  columnReviewStore = reviews
}

export function getColumnReviews(): ColumnReview[] {
  return columnReviewStore
}
```

Update `clearAll()` to reset `columnReviewStore`.

---

## 9. Updated: /api/download/route.ts

```
POST /api/download
Body: {
  sessionId: string,
  format: 'csv' | 'json',
  reviews: ColumnReview[]
}
```

**Step 1:** Read rows via `readStoredRows(sessionId)`.
If file not found, return 400 with message:
"Session data not found. Please start over."

**Step 2:** For each file, apply corrections:
```typescript
import { applyCorrections } from '@/lib/corrector'

const correctedRows = applyCorrections(
  storedRows[filename],
  reviews.filter(r => r.sourceFile === filename)
)
```

**Step 3:** Preserve original column order.
Output columns in the same order as the original file
headers. Do not reorder.

**Step 4:** Generate output.

Single file, CSV:
`papaparse` unparse, return with:
`Content-Disposition: attachment; filename="distil-[originalFilename]"`

Multiple files, CSV:
Use `jszip` — one corrected CSV per file in the zip.
`Content-Disposition: attachment; filename="distil-export.zip"`

JSON (any number of files):
`[{ filename: string, rows: Record<string, unknown>[] }]`

**Step 5:** Cleanup.
`deleteStoredRows(sessionId)` after streaming.

**Install jszip:**
```bash
npm install jszip
npm install --save-dev @types/jszip
```

---

## 10. Updated: export/page.tsx

**Summary row:**
"[n] columns · [n] rows · [n] corrections applied"

Corrections count: sum of `corrections.length` across
all `ColumnReview` objects with `status: 'corrected'`.

**Preview:**
Apply corrections to sample values for display.
Import `applyCorrections` from `lib/corrector.ts`
client-side. Use only the first 3 rows of stored data
for preview — pass them from the store rather than
fetching from the server.

**Remove:**
Any reference to the feedback section.

---

## 11. New file: DATA-FLOW.md

Add to repo root. Document the four-layer architecture
and data flow diagram from the top of this spec.
Plain English. For contributing developers.

---

## 12. Build order

Stop after each step. Run `npx tsc --noEmit`.
Confirm before proceeding.

1. `types/field.ts` — add `source` to `Field`, add
   `offendingCells` to `ExtractionPayload`, add
   `CellCorrection`, `ColumnReview`

2. `lib/corrector.ts` + `lib/corrector.test.ts`
   Run: `npx vitest run lib/corrector.test.ts`
   All tests must pass before step 3.

3. `lib/store.ts` — add `columnReviewStore`

4. `/api/extract/route.ts` — sessionId, /tmp storage,
   offending cells, source field

5. `components/ColumnCard.tsx` — new component

6. `app/review/page.tsx` — ColumnCard rendering,
   reviews state, remove feedback section

7. `npm install jszip && npm install --save-dev @types/jszip`
   then `/api/download/route.ts` — full replacement

8. `app/export/page.tsx` — summary row, preview update

9. `DATA-FLOW.md` — four-layer documentation

---

## 13. What not to build

Do not build any of the following:
- Re-run review with feedback
- Schema toggle or column name mapping
- Google Sheets export
- Cross-file column matching
- Auth or session persistence
- Primary key keying (use rowIndex only for MVP)
- CorrectionRule union types (use ColumnReview/CellCorrection only)
- Deduplication via row removal
- Any feature not in this document or mvp-spec.md
