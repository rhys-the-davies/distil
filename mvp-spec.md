# Distil — MVP spec

## Purpose

Distil is an open-source tool that turns messy, unstructured data into clean, structured output. Users upload spreadsheets, CSV files, and WhatsApp chat exports. Distil parses the files, uses Claude to extract and normalise data fields, flags conflicts and quality issues, and presents a human review interface before producing a clean downloadable file.

The target user is anyone with useful data trapped in inconsistent formats — factory managers, ops teams, researchers, or anyone inheriting legacy data they didn't create. The interface must be operable without any understanding of APIs, data schemas, or structured data.

**Build constraint:** Build only what is described in this spec. Do not add features not specified. Deferred work is logged in `backlog.md`.

---

## Visual design

Distil uses the AWARE™ brand system as its visual foundation — it is comprehensive, well-specified, and a good fit for a clean data tool. The brand file is at `AWARE-BRAND.md` in the repo root. Read it before writing any UI code. Key rules summarised here — the brand file is authoritative.

**Colours — four only:**
- `--color-scarlet: #FF3300` — primary CTA buttons, active states, error indicators, logo
- `--color-earth: #290800` — all text, secondary buttons, borders
- `--color-snow: #F5F5F5` — default page background, the dominant surface (~75% of visual space)
- `--color-white: #FFFFFF` — card surfaces, input backgrounds

**Status colours (extension of the brand system for this app):**
- Errors / missing required fields: Scarlet (`#FF3300`) — high contrast, commands attention
- Warnings / conflicts / needs review: Earth at 55% opacity (`rgba(41, 8, 0, 0.55)`) — readable, on-brand, clearly secondary
- Confirmed / clean: Earth at full opacity, reduced visual weight — no additional colour needed

**Typography:**
- Inter Display (weight 500) for headings — letter-spacing: -0.02em
- Inter (weight 400 and 500) for all body text and UI labels
- Never exceed weight 500. Never use system fonts or any typeface other than Inter and Inter Display.
- Sentence case everywhere. Uppercase only for field labels and status tags.

**Layout:**
- Base unit: 8px. All spacing in multiples of 8.
- Max content width: 1200px, centred.
- Cards: White background, 0.5px Earth border at 15% opacity, 12px border radius, no shadows.
- One primary Scarlet button per view maximum. Everything else secondary (Earth outline) or tertiary (text only).

**Font loading:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Inter+Display:wght@500&display=swap" rel="stylesheet">
```

Copy the following CSS custom properties block exactly into `app/globals.css`. The first block is verbatim from `AWARE-BRAND.md`. The two status colour variables at the end are additions specific to this app.

```css
:root {
  --color-scarlet: #FF3300;
  --color-earth: #290800;
  --color-snow: #F5F5F5;
  --color-white: #FFFFFF;

  --color-text-primary: #290800;
  --color-text-muted: rgba(41, 8, 0, 0.55);
  --color-text-placeholder: rgba(41, 8, 0, 0.35);

  --color-border-default: rgba(41, 8, 0, 0.15);
  --color-border-emphasis: rgba(41, 8, 0, 0.3);
  --color-border-active: #FF3300;

  --font-display: 'Inter Display', 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;

  --letter-spacing-display: -0.02em;
  --letter-spacing-heading: -0.01em;
  --letter-spacing-label: 0.06em;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --transition-base: 0.15s ease;

  /* Status colours — Distil extension of the brand system */
  --color-status-error: #FF3300;
  --color-status-warning: rgba(41, 8, 0, 0.55);
}
```

**Processing screen:** Must reassure the user that their data is being handled carefully. Should feel reliable and dependable — not technical. Do not use a terminal or CLI aesthetic. Beyond that, the visual direction is open. Apply the brand system from `AWARE-BRAND.md`.

**Reference mockup:** A UX reference exists at `reference/review-screen.html`. Use it for component structure, field card behaviour, layout decisions, and interaction patterns only. Do not derive visual design from it — build visual design from the brand system in `AWARE-BRAND.md`.

---

## Tech stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS with brand tokens from `AWARE-BRAND.md` configured in `tailwind.config.ts`
- **AI:** Anthropic Claude API (`claude-sonnet-4-5` via `@anthropic-ai/sdk`)
- **File parsing:** `xlsx` (spreadsheets), `papaparse` (CSV), native string parsing (WhatsApp `.txt`)
- **Storage:** None. Files are parsed in memory on the server and discarded after extraction. No filesystem writes, no database.
- **Hosting:** Vercel
- **Auth:** None for MVP — the portal runs at a single URL, accessible to anyone with the link

---

## Application flow

Four screens in sequence. A user cannot skip forward. The user can navigate back from Screen 3 to Screen 1 to upload additional or replacement files — this clears the current extraction result and restarts the flow.

```
Screen 1: Upload  →  Screen 2: Processing  →  Screen 3: Review  →  Screen 4: Export
                ↑___________________________________|  (start over)
```

---

## Screen 1 — Upload

### Purpose
Collect all source files from the supplier. Provide clear, format-specific instructions so non-technical users know how to export each file type before uploading.

### Layout
Full-page centred layout, max-width 680px. Distil wordmark top-left.

### Components

**Page heading:** "Add your files"
**Subheading:** "Drop in your spreadsheets, CSV exports, or WhatsApp chats. Distil will extract and structure the data for you."

**Export instructions — static expanded list, one section per source type:**

- **WhatsApp**
  Open the chat → tap the contact name (iOS) or three dots (Android) → Export chat → Without media → save the `.txt` file

- **Excel / Google Sheets**
  Excel: File → Save As → CSV (.csv) or Excel Workbook (.xlsx)
  Google Sheets: File → Download → Microsoft Excel (.xlsx) or CSV (.csv)

- **Other CSV**
  Any system that exports to `.csv` is supported. Export from your ERP, production system, or quality management tool and drop the file below.

**`DropZone` component:**
- Accepted formats: `.xlsx`, `.xls`, `.csv`, `.txt`
- Unsupported file types are rejected immediately on drop with an inline error — they do not reach the server
- Drag-and-drop or click to browse
- Shows accepted files as a `FileList` component below the drop zone: filename, detected type badge, file size, remove button
- Minimum 1 valid file required to enable the CTA

**CTA:** "Extract data →" — Scarlet primary button, disabled until at least one valid file is uploaded. On click, POST files to `/api/extract` and navigate to the processing screen.

---

## Screen 2 — Processing

### Purpose
Run extraction server-side while showing the user that something real and reliable is happening. The result either proceeds to review or surfaces an error with a retry option.

### Behaviour

On load, the page fires `POST /api/extract` with the uploaded files. While the single Claude API call is in flight, the UI displays an animated progress sequence. This animation is a designed UI behaviour to communicate progress — it does not reflect separate server-side operations. All steps always complete before the result is shown, regardless of warnings or errors found. Errors and warnings are collected and surfaced in the review screen.

**On completion:** Final status message appears — "Review ready — [n] items need your attention" or "All fields extracted cleanly" if no issues. Primary CTA appears: "Review results →"

**On Claude API error:** Clear error state with a "Try again" button. Uploaded file list is preserved. Do not proceed to review.

### Design direction
The screen should feel reliable and dependable. The visual approach is open — design something that communicates careful, trustworthy processing. Apply the brand system from `AWARE-BRAND.md`. Do not use a terminal, CLI, or developer-tool aesthetic.

### API route: `POST /api/extract`
Accepts multipart form data. Parses all files in memory, builds the Claude prompt, calls Claude, returns `ExtractionPayload` JSON. No files are written to disk or stored after the request completes.

---

## Screen 3 — Review + Approve

### Layout
Two-column grid at desktop widths. Left column: two-thirds width (main review flow). Right column: one-third width (sidebar, sticky on scroll).

A "Start over" link in the topbar navigates back to Screen 1 and clears all state. It should be visually unobtrusive (tertiary text style) but always present. No confirmation dialog needed — nothing has been exported yet.

---

### Left column

**Page heading:** "Review your extraction"
**Subheading:** "[n] files processed"

**Summary paragraph** — plain English generated from the extraction payload:
"[n] fields extracted across [n] files. [n] mapped cleanly. [summary of issues]."

**`ProgressBar` component:** "[n] of [total] fields confirmed · [n]%" — updates live as the user resolves items.

**Metric cards (3-up row):** Fields found · Confirmed · Action needed — all update live from the `fields` array.

---

### Fields requiring action

Rendered for all fields with status `review`, `conflict`, or `missing`. One `FieldCard` per field.

**`FieldCard` — states and behaviour:**

All states are handled inside a single `FieldCard` component. The component receives a `Field` object and renders the appropriate state internally.

*Header (always visible in unresolved state):*
- Field name + status badge
- Source metadata: filename and location as monospace label chips

*`ExtractionBlock` (always shown in unresolved state):*
- Label: "Extraction result"
- Raw value verbatim from the source (monospace)
- Arrow → interpreted value: the system's normalised understanding
- Confidence line: indicator dot + one plain-English sentence explaining the confidence level, referencing the specific file and location

*Conflict block (`conflict` status only):*
- Warning-tinted surface listing each source with its value and date
- Default source labelled as earliest record
- Context strip: full-width tinted band below the card's internal padding, showing 3–5 surrounding messages or rows from the source. The relevant entry is visually highlighted within the strip.

*Actions:*
- `missing`: text input + "Confirm entry" button (disabled until 2+ characters)
- `conflict`: "Use [value] ([source])" button per conflicting source + "Enter correct value" tertiary option that reveals an input
- `review`: "Looks right" button + "Edit" button that reveals an input

*Left border colour coding:*
- `missing` or error: Scarlet left border
- `conflict` or `review`: Earth at 55% opacity left border
- Confirmed: Earth at full opacity left border, reduced visual weight

*Confirmed state:*
- Card collapses to a compact single row showing the confirmed value and source attribution
- "Change" link always visible — clicking fully restores the card to its pre-confirmation state including the context strip and any inputs
- No confirmation is permanent until the final Approve action

---

### Processed fields table

Below the action-required cards. Collapsible section, expanded by default.

**`ProcessedFieldsTable` component.** Read-only for MVP. Columns: Field · Extracted value · Source · Status

No inline edit. If the user spots an error in a clean field, they use the feedback section below.

---

### Feedback section

Present in the UI but non-functional in MVP. Textarea with a disabled "Re-run review" button, labelled "Coming soon". This reserves the space and sets user expectations without requiring the `/api/rerun` route to be built. See `backlog.md` for the full re-run spec.

---

### Approve section

At the bottom of the left column.

**Heading:** "Ready to export?"
**Body:** Dynamic — shows number of outstanding fields when items remain, or "All fields confirmed. Choose your output format." when all are resolved.
**"Choose export format →" button** — Scarlet primary, disabled until all `missing`, `conflict`, and `review` status fields are resolved.

**On click:** Navigates to Screen 4 — Export. The resolved `fields` array is passed via query param or session state.

---

### Right column — sidebar

**`FileList` card:** One row per uploaded file — file type badge, filename, size and row/message count, status badge.

**`SummaryCard`:** Files processed · Fields extracted · Source conflicts · Issues found.

**`ReviewChecklist` card:** One row per action-required field — field name and live status badge. Updates as the user resolves items.

---

## Screen 4 — Export

### Purpose
Let the user choose their output format, optionally map to an existing structure, preview the result, and download.

### Layout
Centred, single-column, max-width 640px. Same topbar as other screens with "Start over" link.

### Components

**Page heading:** "Your data is ready"
**Summary row:** [n] fields confirmed · [n] sources merged

---

**Format picker — 2 options, one selectable at a time:**

- **CSV** (default selected) — "Opens in Excel, Google Sheets, or any data tool"
- **JSON** — "For developers piping output to another system"

Selecting a format updates the preview and the download button label immediately.

---

**Live preview panel:**

Shows the first 3 rows of the output and the first 6 columns with a label noting total column count. Updates when format or schema changes.

- CSV: renders a table with column headers and row values
- JSON: renders a formatted code block with the first record and a "// N more records..." note

---

**Download button:**

- Label: "Download CSV" or "Download JSON" depending on format selection
- Scarlet primary button, full width
- On click: calls `/api/download` with the resolved payload and format
- On success: file download triggers immediately

---

## State management

All review screen state lives in a single `fields` array in `review/page.tsx`, managed with React `useState`. No external state library. No Zustand, no Context API, no URL state for MVP.

The `fields` array is the single source of truth. All derived values — progress percentage, confirmed count, checklist badge states, approve button enabled state — are computed from the array on each render. When the user resolves a field, edits a value, or triggers a re-run, the array is updated and everything re-renders from it.

This structure is intentionally simple. When Supabase auth and persistence are added later, this state can be hydrated from a database record and persisted on change without restructuring the component.

**Passing state from Screen 3 to Screen 4:** When the user clicks "Choose export format →", the resolved `fields` array is serialised to `sessionStorage` under the key `distil_payload`. Screen 4 reads from `sessionStorage` on load. This is the only permitted use of `sessionStorage` in the MVP — it does not persist beyond the browser tab.

---

## File parsers

No Claude involvement in file type detection or parsing. Each supported format has a dedicated parser in `lib/parsers/`. File type is detected by extension at upload.

| Format | Extensions | Parser | Notes |
|---|---|---|---|
| Excel | `.xlsx`, `.xls` | `xlsx` npm package | Extract all sheets as arrays of row objects |
| CSV | `.csv` | `papaparse` | Header row auto-detection enabled |
| WhatsApp | `.txt` | `lib/parsers/whatsapp.ts` | Handle both iOS format (`DD/MM/YYYY, HH:MM`) and Android format (`M/D/YY, HH:MM`) |

**Parse failure:** If a single file fails to parse, record the error for that file and continue with remaining files. The failed file is excluded from the Claude prompt with a note that it could not be read. Do not block the session on a single file failure.

**Unsupported formats:** Rejected at the `DropZone` with an inline error message. Never reach the server.

---

## Field schema

In the generic Distil MVP, Claude infers fields directly from the uploaded file content — there is no fixed schema. The extraction prompt instructs Claude to identify all recognisable data fields in the source files and return them, rather than mapping to a predefined list.

The `lib/schema.ts` file is retained as an empty stub with the `FieldDefinition` interface exported. This is the extension point for downstream applications (such as AWARE™) that want to constrain extraction to a fixed schema. When a schema is provided, it is passed to the Claude prompt and used to guide mapping. When absent, Claude extracts freely.

```typescript
// lib/schema.ts
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
```

---

## Claude system prompt

The system prompt lives in `prompts/review.md`. It is loaded at runtime in API routes via `lib/prompts.ts` using `fs.readFileSync` and passed as the `system` parameter to the Claude API call. It is never exposed client-side.

The file is human-editable without touching any application code, and is version-controlled alongside the rest of the codebase.

**`lib/prompts.ts`:**
```typescript
import fs from 'fs'
import path from 'path'

export function getReviewPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts/review.md'), 'utf-8')
}
```

**`prompts/review.md`:**

```
You are Distil — a data extraction and quality review system. Your role is to parse uploaded files, extract all recognisable structured data fields, and flag quality issues for human review.

You always follow these steps in this exact order:
1. Parse all provided file contents
2. Identify and extract all recognisable production data fields
3. Cross-reference values across sources and flag conflicts
4. Check all required fields are present
5. Assess confidence for each extracted value
6. Map extracted values to the field schema if one is provided; otherwise extract all recognisable fields freely
7. Return a structured JSON response matching the defined output schema

You always respond with valid JSON only. No preamble, no explanation, no markdown fences.

For each field in the schema, return an object with:
- id: a snake_case identifier derived from the field name
- label: human-readable field name
- status: one of clean | review | conflict | missing
- confidence: one of high | medium | low | none
- confidenceReason: one plain-English sentence. Reference the file name and location specifically.
- rawValue: the literal string as it appeared in the source
- interpretedValue: your normalised interpretation (ISO 8601 for dates, numeric string for numbers)
- sourceFile: filename
- sourceLocation: specific location — row number, column, sheet name, or message timestamp

Confidence rules:
- high: single unambiguous source, standard format, no interpretation required
- medium: single source, but interpretation was needed (date format inference, unit inference, abbreviation expansion)
- low: conflicting values across sources, or format is highly irregular
- none: field not found in any source — return status: missing

For conflicts, include a conflict object with:
- sources: array of { file, location, value, date } — one per conflicting source
- defaultSource: index of the source to use as default (always the earliest by date)
- context: array of { who, text, highlight } — surrounding rows or messages, with the relevant entry marked highlight: true

Never guess or hallucinate values. If a field is not present in the source data, return status: missing. Never populate a missing field with an assumed value.

Never include conversational language, hedging, or observations outside the JSON structure. Respond as a structured audit system.
```

---

## TypeScript types

Define shared types in `types/field.ts`. Import from here throughout the app.

```typescript
// types/field.ts

export type FieldStatus = 'clean' | 'review' | 'conflict' | 'missing'
export type FieldConfidence = 'high' | 'medium' | 'low' | 'none'

export interface ConflictSource {
  file: string
  location: string
  value: string
  date: string
}

export interface ContextMessage {
  who: string
  text: string
  highlight: boolean
}

export interface FieldConflict {
  sources: ConflictSource[]
  defaultSource: number
  context: ContextMessage[]
}

export interface Field {
  id: string
  label: string
  status: FieldStatus
  confidence: FieldConfidence
  confidenceReason: string | null
  rawValue: string | null
  interpretedValue: string | null
  sourceFile: string | null
  sourceLocation: string | null
  required: boolean
  conflict?: FieldConflict
  resolvedValue?: string     // set client-side when user confirms a value
  resolvedSource?: string    // set client-side when user confirms a source
}

export interface ExtractionSummary {
  filesProcessed: number
  fieldsExtracted: number
  fieldsConfident: number
  conflicts: number
  missingRequired: number
  warnings: number
}

export interface ExtractionPayload {
  summary: ExtractionSummary
  fields: Field[]
}
```

---

## Component tree

```
app/                          Next.js App Router
  page.tsx                    → redirect to /upload
  upload/
    page.tsx
  processing/
    page.tsx
  review/
    page.tsx                  → owns the fields array in useState
  export/
    page.tsx                  → receives resolved fields, handles format/schema selection

components/
  DropZone.tsx                drag-and-drop file upload with type validation
  FileList.tsx                list of files with type badge, size, remove button
                              used on upload screen and in review sidebar
  StepFeed.tsx                processing screen progress animation
  StatusRow.tsx               single step row — icon + label + detail
                              used inside StepFeed
  FieldCard.tsx               renders a field in any state: unresolved, conflict,
                              missing, review, confirmed — all states internal
  ExtractionBlock.tsx         raw → interpreted value display
                              used inside FieldCard
  ProcessedFieldsTable.tsx    clean fields table — read-only for MVP
  ProgressBar.tsx             progress bar with label and percentage
  ReviewChecklist.tsx         sidebar checklist of action-required fields
  SummaryCard.tsx             sidebar import summary figures
  ExportScreen.tsx            format picker (CSV / JSON), preview, download button

lib/
  schema.ts                   FIELD_SCHEMA array — single source of truth
  prompts.ts                  loads prompts/review.md at runtime, exports getReviewPrompt()
  parsers/
    xlsx.ts                   Excel parser using xlsx package
    csv.ts                    CSV parser using papaparse
    whatsapp.ts               WhatsApp .txt parser — handles iOS and Android formats

prompts/
  review.md                   Claude system prompt — human-editable, version-controlled

types/
  field.ts                    shared TypeScript interfaces for the field payload
```

---

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/extract` | POST | Accept files, parse in memory, call Claude, return `ExtractionPayload` |
| `/api/download` | POST | Accept resolved payload, return CSV or JSON file for download |

### `/api/extract`
1. Receive multipart form data
2. Detect file type by extension, reject unsupported types
3. Route each file to the appropriate parser in `lib/parsers/`
4. Record parse failures per file; continue with remaining files
5. Assemble parsed content and `FIELD_SCHEMA` into the Claude prompt
6. Load system prompt via `getReviewPrompt()`
7. Single call to Claude API (`claude-sonnet-4-5`)
8. Parse and validate JSON response
9. Merge `required` flag from `FIELD_SCHEMA` into each field object
10. Return `ExtractionPayload`

### `/api/download`
1. Receive resolved `ExtractionPayload` and `format` parameter (`csv` | `json`)
2. For CSV: transform resolved fields array into CSV rows using `papaparse`, return as file download with `Content-Disposition: attachment`
3. For JSON: return resolved fields array as formatted JSON file download
4. No external API calls — output is always a local file

---

## Output format

Distil produces a clean downloadable file from the reviewed and confirmed field payload. Format is chosen on Screen 4.

**CSV (default):** One row per extracted record. Column headers are field labels derived from the extraction. Generated server-side via `papaparse`.

**JSON:** The full resolved `ExtractionPayload` as a formatted JSON file. For developers piping output to another system.

**Schema mapping and platform integration** are deferred from the MVP — see `backlog.md` for the full spec including paste-column-headers, Google Sheets structure matching, and the AWARE™ platform schema path.

---

## Environment variables

```
ANTHROPIC_API_KEY=
```

All environment variables are server-side only. Never expose them client-side.

---

## Error handling

| Error | Behaviour |
|---|---|
| Unsupported file type at upload | Rejected inline in `DropZone`. Never reaches server. |
| File parse failure | Recorded per file. Session continues with remaining files. Failed file noted in Claude prompt. |
| Claude API error on `/api/extract` | Error state on processing screen. "Try again" button. Uploaded file list preserved. |
| Download generation failure | Error message inline. Resolved payload preserved — user can retry without repeating review. |
| Network timeout | Treated as API error in all cases. |

---

## Future: auth and persistence

Deferred from MVP.

**What is deferred:**
- User accounts and authentication
- Session persistence — ability to resume a review after closing the browser
- Extraction history and audit trail
- Schema-constrained extraction (e.g. mapping to the AWARE™ field schema) — see `backlog.md`
- External API write integration (e.g. posting output to AWARE™) — see `backlog.md`

**Architectural decisions made now to enable this later:**

- All API routes accept an optional `sessionId` parameter in the request body even though it is unused in the MVP. This avoids restructuring routes when persistence is added.
- No `localStorage`, `sessionStorage`, or any client-side persistence. All state lives in React `useState` for the duration of the browser session only.
- The `ExtractionPayload` type is self-contained and serialisable — it can be written to a database or passed to an external API without restructuring.

**Processing screen architecture:** The MVP uses a single Claude API call with a designed progress animation. A future version should use genuinely separate API calls per processing step so the UI reflects actual server state and partial failures can be handled gracefully. See `backlog.md`.

---

## Required files

The following files are present in the repo root and must be read before writing any code:

```
AWARE-BRAND.md          read this before writing any UI code — defines the complete visual system
reference/
  review-screen.html    read this before building Screen 3 — UX reference for component structure,
                        field card behaviour, and interaction patterns. Not a visual reference.
prompts/
  review.md             the Claude system prompt loaded at runtime by lib/prompts.ts
```

**Build one screen at a time.** Complete each screen fully before starting the next. After each screen, stop and wait for confirmation before proceeding.

