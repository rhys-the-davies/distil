# Distil — mode picker spec
## Branch: feature/mode-picker

Read this document completely before writing any code.
Also read mvp-spec.md and DATA-FLOW.md for full context.
This document specifies additive changes only — do not
modify anything not mentioned here.

---

## What this feature does

Adds a mode selector to the upload screen. The user
chooses their intent before uploading files. The selected
mode controls which files are accepted, which pipeline
runs, and how the export is generated.

Two modes are live. One is greyed out (coming soon).

---

## The three modes

### Find issues (live — existing behaviour)
**User intent:** "I have structured data. Help me find
and fix quality problems."

Input: CSV, XLSX only.
Pipeline: observe → profile → interpret flagged columns.
Review: ColumnCard for profiler fields.
Export: corrected original rows via parsedRows.

No changes to this pipeline. It already works.

### Structure (live — new)
**User intent:** "I have messy files. Help me turn them
into clean structured data."

Input: CSV, XLSX, TXT, WhatsApp exports.

Pipeline for CSV/XLSX: observe → profile → interpret
flagged columns (same as find-issues, different output
intent). Claude receives profiler summary only — never
raw file content.

Pipeline for TXT/WhatsApp: observe → Claude full
extraction. Claude receives the raw file content.
Content must be under 50KB — enforce at upload.

Review: FieldCard for extraction fields.

Export: CSV/JSON derived from resolved Field[] values
grouped by recordIndex. No parsedRows.

### Follow schema (coming soon — greyed out)
Not built. Disabled card on the upload screen only.
No routing, no pipeline, no other UI.

---

## Architecture: one flow, mode-driven branches

One /api/extract route. One review screen. One export
screen. Mode drives conditional logic at specific
branch points. No duplication.

The find-issues and structure pipelines are extracted
into separate functions in lib/pipelines/ — the route
handler stays thin and readable.

```
/api/extract (thin route handler)
  → validate inputs (mode, sessionId, files)
  → parse files (shared)
  → Pass 0: observe (shared)
  → if mode === 'find-issues':
      → lib/pipelines/find-issues.ts
  → if mode === 'structure':
      → CSV/XLSX: lib/pipelines/structure-tabular.ts
      → TXT: lib/pipelines/structure-text.ts

Review screen — unchanged. Already handles:
  source: 'profiler' → ColumnCard
  source: 'extraction' → FieldCard

Export screen — one new branch:
  parsedRows present → find-issues path (existing)
  parsedRows absent → structure path (new: fields → rows)
```

---

## 1. New types

Add to types/field.ts alongside existing types.

```typescript
export type DistilMode =
  'find-issues' | 'structure' | 'follow-schema'

// Add to existing Field interface:
recordIndex?: number
// Zero-based. Groups extraction fields into rows
// for CSV export. Set by Claude on extraction fields.
// Not used on profiler fields.
```

---

## 2. Updated: lib/store.ts

```typescript
// Add alongside existing store entries:
let distilMode: DistilMode = 'find-issues'

export function setMode(mode: DistilMode): void {
  distilMode = mode
}

export function getMode(): DistilMode {
  return distilMode
}

// Update clearAll() to include:
distilMode = 'find-issues'
```

---

## 3. New pipeline files

### lib/pipelines/find-issues.ts

Extract the existing find-issues logic from
/api/extract/route.ts into this file. The function
signature:

```typescript
export async function runFindIssuesPipeline(
  parsed: ParsedFile[],
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
  parsedRows: Record<string, Record<string, unknown>[]>
  offendingCells: ExtractionPayload['offendingCells']
  sampleRows: ExtractionPayload['sampleRows']
}>
```

Move the following from route.ts into this file:
- buildInterpretationUserMessage()
- extractOffendingCells()
- columnToCleanField()
- validateField()
- All Pass 1 (profiler) logic
- All Pass 2 (interpretation) logic
- The merge step (claudeFields + cleanFields)
- parsedRows construction
- offendingCells construction
- sampleRows construction

Do not move: parsing logic, observation pass,
summary building, or response construction.
Those stay in the route handler.

### lib/pipelines/structure-tabular.ts

For CSV and XLSX files in structure mode.

Uses the same profiler as find-issues. The difference
is output intent: instead of correcting original rows,
the output is interpreted structured data.

```typescript
export async function runStructureTabularPipeline(
  parsed: ParsedFile[],
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
}>
```

**What this pipeline does:**

Step 1: Run the profiler on each file (same as
find-issues Pass 1). Get ProfilerResult.

Step 2: Call Claude with getStructurePrompt() and a
structure-mode prompt payload. Claude receives:
- FileCharacterisation for each file
- For flagged columns: ALL values in the column
  (not just the 10 offending cells used in find-issues).
  Claude needs all values to produce normalised output
  for all rows.
- For clean columns: column name and data type only.
  Claude does not need to process clean columns.

Claude's job: for each flagged column, return one
normalised Field per row — same field id, incrementing
recordIndex. Claude must return a complete set for
every row in the file, not just the flagged cells.

Step 3: For clean columns, generate one Field per row
directly from the full parsed row data. This is
deterministic — no Claude needed. Each Field gets:
- id: derived from column name
- label: column name
- recordIndex: row index (zero-based)
- status: 'clean'
- source: 'extraction'
- rawValue and interpretedValue: the cell value for
  that row

This requires access to the full parsed row array —
pass it into the pipeline function alongside the
profiler result.

Step 4: Merge Claude fields (flagged columns) and
clean column fields (all rows) into a complete Field[].
The result is one Field per cell in the original file,
grouped by recordIndex into rows.

Note: parsedRows is NOT returned from this pipeline.
The export derives rows from Field[] using recordIndex.

**Row limit — MVP:**
Structure-tabular mode processes a maximum of 50 rows.
If the file has more than 50 rows, process only the
first 50. Include a note in the extraction summary:
"Structure mode processed 50 of [total] rows in this
version. Upload a file with 50 or fewer rows to extract
all records."

This limit is explicit, not implicit. Do not silently
truncate — always tell the user. Chunked extraction
for larger files is in the backlog.

### lib/pipelines/structure-text.ts

For TXT and WhatsApp files in structure mode only.

```typescript
export async function runStructureTextPipeline(
  parsed: ParsedFile[],  // TXT files only
  characterisations: Map<string, FileCharacterisation>,
  failures: Array<{ filename: string; error: string }>,
  client: Anthropic,
): Promise<{
  fields: Field[]
}>
```

**What this pipeline does:**

Step 1: Serialise file content as raw text with a
file header and the FileCharacterisation as context.
The serialised content replaces the profiler summary
since TXT files have no tabular structure to profile.

Step 2: Call Claude with getStructurePrompt() and the
serialised content. Max tokens: 4096.

Step 3: Return Field[] with source: 'extraction' and
recordIndex set by Claude.

**Size guard:**
Before calling Claude, check serialised content
length. If over 40,000 characters (~10k tokens),
truncate with a note appended to the content:
"[Content truncated at 40,000 characters. Extract
from the content above only.]"

This limit is enforced server-side even though
DropZone already enforces a 50KB file size limit —
defence in depth.

---

## 4. Updated: /api/extract/route.ts

The route handler becomes thin. After this change it
should be under 80 lines excluding imports.

**Add a structured log line** at the end of each
successful extraction, before returning the response:

```typescript
const startTime = Date.now() // set at top of handler

console.log(JSON.stringify({
  event: 'extraction_complete',
  mode,
  filesProcessed: parsed.length,
  totalRows: parsed.reduce((n, f) => n + f.rows.length, 0),
  fieldsExtracted: fields.length,
  durationMs: Date.now() - startTime,
}))
```

This is the minimum observability needed to understand
real-world usage, token costs, and performance. It
costs nothing and produces structured logs that can
be parsed later.

```typescript
export async function POST(request: NextRequest) {
  // 1. Parse form data
  // 2. Validate: sessionId, mode, files present
  // 3. Parse files (existing parsing logic stays here
  //    since it's shared by all modes)
  // 4. Pass 0: observation (shared, stays here)
  // 5. Branch by mode:

  if (mode === 'find-issues') {
    const result = await runFindIssuesPipeline(
      parsed, characterisations, failures, client
    )
    // build summary + payload + return
  }

  if (mode === 'structure') {
    const tabular = parsed.filter(
      f => f.result.type === 'csv' || f.result.type === 'xlsx'
    )
    const text = parsed.filter(
      f => f.result.type === 'plaintext' ||
           f.result.type === 'whatsapp'
    )

    const tabularResult = tabular.length > 0
      ? await runStructureTabularPipeline(
          tabular, characterisations, failures, client
        )
      : { fields: [] }

    const textResult = text.length > 0
      ? await runStructureTextPipeline(
          text, characterisations, failures, client
        )
      : { fields: [] }

    const fields = [
      ...tabularResult.fields,
      ...textResult.fields,
    ]
    // build summary + payload (no parsedRows) + return
  }
}
```

**Route-level file type gating:**
TXT files are rejected with a clear error if mode is
not 'structure'. This is enforced in the parsing loop:

```typescript
if (ext === '.txt' && mode !== 'structure') {
  failures.push({
    filename: file.name,
    error: 'Plain text files require Structure mode.'
  })
  continue
}
```

---

## 5. New prompt file: prompts/structure.md

```
You are Distil's structure extraction pass. You receive
a profiler summary or raw file content, and a
characterisation of each file. Your job is to extract
and normalise every data value and return structured
field objects.

CRITICAL — record completeness:
Extract every individual record. Do not summarise.
If a file contains 50 rows, return 50 complete sets
of field objects — one complete set per row.
If you find yourself about to write "and N more like
this" — stop. Extract them all instead.

If you cannot extract all records within your response
limit, extract as many complete records as possible
and add a field with id "_extraction_note", label
"Extraction note", status "review", and rawValue
describing how many records were extracted vs total.

Use recordIndex to group fields into records:
- All fields from record 1 get recordIndex: 0
- All fields from record 2 get recordIndex: 1
- And so on, sequentially

For CSV/XLSX input (profiler summary):
You receive flagged columns only. For each flagged
column, extract and normalise the values for all
affected rows. Use the row number from the profiler
data as recordIndex. For clean columns, they will be
handled separately — do not return them.

For TXT/WhatsApp input (raw content):
Read the content completely. Identify distinct records
(messages, entries, line items). Extract all fields
from each record. Assign sequential recordIndex values.

Return a single JSON object: { "fields": [...] }

For each field object:
- id: snake_case identifier, same across all records
  of the same field type
- label: human-readable field name
- recordIndex: integer, zero-based
- status: clean | review | missing
- confidence: high | medium | low | none
- confidenceReason: one plain-English sentence
- rawValue: literal string from source
- interpretedValue: your normalised interpretation
- sourceFile: filename
- sourceLocation: row number, line, or timestamp
- source: "extraction" (always)

Never hallucinate. Never populate missing fields with
assumed values. Return valid JSON only. No markdown.
```

---

## 6. Updated: lib/prompts.ts

```typescript
export function getStructurePrompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'prompts/structure.md'),
    'utf-8'
  )
}
```

---

## 7. New component: ModePicker

Create components/ModePicker.tsx.

### Props

```typescript
interface ModePickerProps {
  selected: DistilMode
  onChange: (mode: DistilMode) => void
}
```

### Layout

Three cards in a row at desktop, stacked on mobile.
Each card: mode name (bold), one-line description,
accepted file types (small muted text).

Selected card: Earth left border (3px), slightly
elevated visual weight.
Unselected active card: default border.
Disabled card (Follow schema): 40% opacity, not
clickable, "Coming soon" label.

### Card content

**Find issues**
Name: "Find issues"
Description: "Find and fix quality problems in structured data"
Files: "CSV and Excel"

**Structure**
Name: "Structure"
Description: "Turn messy files into clean structured data"
Files: "CSV, Excel, and plain text"

**Follow schema**
Name: "Follow schema"
Description: "Map your data to a target structure"
Files: "Coming soon"
Disabled: true

### Behaviour

Clicking Follow schema: no action.
Clicking an active mode: call onChange, clear uploaded
files (different modes accept different types).

---

## 8. Updated: app/upload/page.tsx

```typescript
const [mode, setMode] = useState<DistilMode>('find-issues')

function handleModeChange(newMode: DistilMode) {
  setMode(newMode)
  setFiles([])          // clear files on mode change
  setPendingFiles([])
}
```

Render ModePicker above DropZone.

Pass accepted formats to DropZone based on mode:

```typescript
const acceptedFormats =
  mode === 'structure'
    ? ['.xlsx', '.xls', '.csv', '.txt']
    : ['.xlsx', '.xls', '.csv']
```

Rejection message by mode:
- find-issues: "Only CSV and Excel files are supported
  in Find issues mode."
- structure: "Supported: CSV, Excel, and plain text
  (.txt) files."

On extract click:
```typescript
setModeInStore(mode)
formData.append('mode', mode)
```

---

## 9. Updated: lib/corrector.ts

Add fieldsToRows() to lib/corrector.ts alongside the
existing applyCorrections() and isEmpty(). Both are
pure data transformation functions — this is the right
home for both.

```typescript
// Add to lib/corrector.ts:

/**
 * Convert a Field[] (extraction mode output) into
 * row objects for CSV/JSON export.
 * Groups fields by recordIndex, sorts by recordIndex,
 * maps each group to a { label: value } row object.
 * Used by both /api/download and the export preview.
 */
export function fieldsToRows(
  fields: Field[]
): Record<string, string>[] {
  const groups = new Map<number, Field[]>()
  for (const field of fields) {
    const idx = field.recordIndex ?? 0
    if (!groups.has(idx)) groups.set(idx, [])
    groups.get(idx)!.push(field)
  }
  const sorted = Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
  return sorted.map(([, group]) => {
    const row: Record<string, string> = {}
    for (const field of group) {
      row[field.label] =
        field.resolvedValue ??
        field.interpretedValue ??
        field.rawValue ?? ''
    }
    return row
  })
}
```

Add unit tests to lib/corrector.test.ts:
- Groups fields by recordIndex correctly
- Sorts records by recordIndex (not insertion order)
- Uses resolvedValue over interpretedValue over rawValue
- Fields with no recordIndex all go to record 0
- Empty fields array returns empty array

## 10. Updated: /api/download/route.ts

Import fieldsToRows from lib/corrector. In the route
handler, after reading parsedRows:

```typescript
// Existing find-issues path:
if (parsedRows && Object.keys(parsedRows).length > 0) {
  // apply ColumnReview[] corrections to parsedRows
  // existing logic unchanged
}

// New structure mode path:
else {
  // derive rows from Field[]
  const fields = (body.fields ?? []) as Field[]
  const rows = fieldsToRows(fields)
  // generate CSV/JSON from rows
  // same output format as find-issues
}
```

Update the download request body in app/export/page.tsx
to include `fields: payload.fields` alongside existing
fields. The route uses parsedRows if present, fields
if not.

---

## 10. Updated: app/export/page.tsx

Update preview to handle structure mode (no sampleRows):

```typescript
// Existing: sampleRows from payload drives the preview
// New: if no sampleRows, derive preview from fields

const sampleRows = payload.sampleRows

const csvPreview = sampleRows && Object.keys(sampleRows).length > 0
  ? buildCsvPreview(sampleRows, reviews)
  : buildCsvPreviewFromFields(payload.fields, 5)
```

Add (import fieldsToRows from lib/corrector):

```typescript
import { fieldsToRows } from '@/lib/corrector'

function buildCsvPreviewFromFields(
  fields: Field[],
  maxRows: number
): CsvPreview {
  const rows = fieldsToRows(fields)
  const preview = rows.slice(0, maxRows)
  const headers = preview.length > 0 ? Object.keys(preview[0]) : []
  const totalCols = headers.length
  const visible = headers.slice(0, PREVIEW_MAX_COLS)
  return {
    headers: visible,
    rows: preview.map(row => visible.map(h => String(row[h] ?? ''))),
    totalCols,
  }
}
```

---

## 11. File parser updates

### Re-enable .txt in parsers

lib/parsers/whatsapp.ts already has parseTxt and
WhatsApp detection. Re-import in route.ts for
structure mode only. The import already exists in
the codebase — it was removed from the route when
.txt support was dropped. Add it back conditionally.

### DropZone rejection message update

Update the rejection message copy in DropZone.tsx
to accept a prop for the message, or pass the mode-
appropriate message from the upload page.

---

## 12. Updated: DATA-FLOW.md

Add a section documenting the mode-driven pipeline
branching. Update the data flow diagram to show
both paths. Keep the four-layer architecture section
unchanged — it applies to both modes.

---

## 13. Build order

Stop after each step. Run npx tsc --noEmit. Confirm.

1. types/field.ts
   Add DistilMode, recordIndex to Field

2. lib/store.ts
   Add mode store

3. lib/pipelines/ (new directory)
   - find-issues.ts: extract existing logic from route
   - structure-tabular.ts: new, uses profiler
   - structure-text.ts: new, Claude full extraction

4. prompts/structure.md
   New prompt file

5. lib/prompts.ts
   Add getStructurePrompt()

6. components/ModePicker.tsx
   New component

7. app/upload/page.tsx
   Add ModePicker, conditional formats, pass mode

8. /api/extract/route.ts
   Thin route handler, branch to pipelines,
   .txt gating by mode

9. lib/corrector.ts
   Add fieldsToRows() + unit tests
   Run: npx vitest run lib/corrector.test.ts

10. /api/download/route.ts
    Import fieldsToRows from lib/corrector,
    add structure mode export path,
    update to accept fields in request body

11. app/export/page.tsx
    Import fieldsToRows from lib/corrector,
    add buildCsvPreviewFromFields(),
    conditional preview path

12. DATA-FLOW.md
    Document mode branching

---

## 14. What not to build

- Follow schema mode beyond the disabled UI card
- Any changes to FieldCard or ColumnCard
- Any changes to the review screen
- Re-run with feedback
- Chunked extraction (in backlog)
- Any feature not in this spec or mvp-spec.md

---

## 15. Backlog additions from this spec

Add these to backlog.md when the branch is complete:

**Chunked extraction for structure mode**
Structure mode currently processes 50 rows maximum.
For larger files, the pipeline should chunk the input
into batches of 50 rows, make one Claude call per
batch, and merge the Field[] results. Merge strategy:
assign recordIndex sequentially across batches (batch
1 rows 0-49, batch 2 rows 50-99, etc.). This removes
the row limit entirely.

**DatasetOutput type — unified export representation**
Both find-issues and structure mode currently use
different paths to produce export data (parsedRows +
ColumnReview[] vs Field[] + fieldsToRows). A unified
DatasetOutput type — headers[] + rows[] + annotations[]
— would decouple the export mechanism from the pipeline
output. Both pipelines produce DatasetOutput. The export
screen and download route only know about DatasetOutput.
This removes the conditional parsedRows check and makes
adding new modes straightforward.

---

## 16. Testing checklist

**Find issues (regression):**
- Upload Goldstar CSV
- ColumnCards render for flagged columns
- Resolve all → download → 200 rows with corrections

**Structure, CSV input:**
- Upload a messy CSV with inconsistent values
- FieldCards render with extracted and normalised fields
- Fields grouped by recordIndex
- Download CSV → one row per record, clean values

**Structure, TXT input:**
- Upload test-simple-messy.txt
- FieldCards render with extracted entities
- Supplier name, batch reference, weight conflict flagged
- Download CSV → structured output from the notes

**Mode switching:**
- Switch from find-issues to structure → file list clears
- Upload a .txt in find-issues → rejected with clear message
- Upload a .txt in structure → accepted
