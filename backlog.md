# Backlog

## File preview in review cards

**Context:** When a conflict or error is flagged in a specific file, the review card should render a preview of the source file itself — not just surface the extracted value — so the user can see the issue in context and modify the source if needed.

**Behaviour:**
- For CSV/XLSX: render the relevant rows of the file inline in the card, with the conflicting or missing cell highlighted. Allow the user to edit the cell value directly in the preview. Changes update the extracted value in real time.
- For WhatsApp exports: render the surrounding message thread (3–5 messages either side) with the relevant message highlighted. The extracted value is shown alongside.
- For email exports: render the relevant email body with the relevant passage highlighted.

**Why it matters:** The user's instinct when they see a conflict is to go check the source. This closes that loop inside the tool rather than asking them to open a separate file, find the row, and come back. It also means corrections happen at the source, not just as overrides layered on top.

**Inspiration:** GitHub diff view — shows exactly which line changed, in context, with the ability to comment or edit inline.

**Open questions:**
- Does editing the preview update the source file, or just the extracted value for this import session?
- How do we handle very large files — paginate the preview or just show the relevant window?
- XLSX files with merged cells or complex formatting may not render cleanly — need a fallback.

**Priority:** Post-MVP

---

## Processing screen — visual redesign

**Context:** The CLI-style processing screen (dark terminal, monospace font, `$` prefixes) reads as too technical for the target user — a factory manager who may have never seen a terminal. The underlying logic is correct: steps appear in sequence, warnings surface inline, errors stop the flow, and a CTA appears only when the run completes.

**What needs to change:** The visual skin, not the structure. Replace the terminal aesthetic with something that feels more like a progress tracker or status feed. Think: named steps with icons or status dots, plain-language descriptions instead of command syntax, a warmer colour palette. The information density and sequencing should stay the same.

**What to keep:**
- Step-by-step reveal as each stage completes
- Colour-coded outcomes (success / warning / error)
- Stops and surfaces all errors before proceeding
- "Review results" CTA only appears on completion

**Priority:** Pre-launch visual polish — structure is MVP, skin is not

---

## AWARE™ API — replace mock contract with real integration

**Context:** The AWARE™ API does not exist at the time the import portal MVP is built. The portal's `/api/approve` route is built against a provisional mock contract defined in the MVP spec. This was a deliberate architectural decision to unblock the portal build.

**What needs to happen:**
- The real AWARE™ API design will be informed by the confirmed AWARE™ data schema, which is being mapped separately
- When the real API endpoints and auth model are confirmed, only `/api/approve` needs to be updated
- The field IDs in `lib/schema.ts` should align with the real API's field naming conventions — review and update `FIELD_SCHEMA` at the same time
- The mock endpoint (`POST /imports`) and the payload structure in `/api/approve` are the only integration points that change

**Decision recorded:** Building against a mock contract is the right call here. The portal's value is in the extraction and review flow — the write to AWARE™ is a boundary that can be swapped cleanly.

**Priority:** Required before production use — not MVP-blocking

---

## Processing screen — separate API calls per step

**Context:** The MVP uses a single Claude API call for the full extraction, with a designed progress animation on the processing screen that does not reflect actual server-side operations. This was a deliberate simplification for MVP.

**What a proper implementation looks like:**
- Break extraction into genuinely separate API calls: parse files → extract fields → cross-reference sources → quality check → schema mapping
- Each call updates the processing screen with real status as it completes
- Partial failures can be surfaced at the step that failed rather than failing the whole session
- Enables more granular retry logic

**Constraint to keep in mind:** Claude Code should build the processing screen and the `/api/extract` route in a way that makes this refactor straightforward — clean separation between the animation layer and the data fetching layer, so the animation can later be driven by real step responses rather than a timer.

**Priority:** Post-MVP — performance and reliability improvement

---

## Email export support

**Context:** Email exports (`.eml`, `.mbox`) were cut from the MVP file parser list. The variance between email clients (Gmail, Outlook, Apple Mail) makes parsing complex relative to the payoff for an initial test. Most production data lives in spreadsheets and WhatsApp.

**What to build when adding this:**
- `lib/parsers/email.ts` — extract sender, date, subject, plain-text body
- Add `.eml` and `.mbox` to the `DropZone` accepted formats
- Add an instruction section to the upload screen for Gmail export steps
- Update the Claude prompt to handle email-sourced fields

**Priority:** Post-MVP — add when a real supplier asks for it

---

## Re-run review with feedback

**Context:** The feedback section exists in the MVP UI but is non-functional (textarea + disabled button). The full re-run flow was designed but deferred to keep the MVP scope tight.

**Full spec when building this:**
- `POST /api/rerun` route — accepts feedback text string + current `ExtractionPayload`
- Load base system prompt via `getReviewPrompt()`
- Append feedback as a temporary instruction: `"Additional instruction for this review only: [feedback text]"` — not written to `prompts/review.md`
- Re-run full extraction with the same parsed file content (passed from client state) and the augmented prompt
- Return a fresh complete `ExtractionPayload` — client replaces entire `fields` array
- Enable the "Re-run review" button and wire it to the new route

**Priority:** High post-MVP — meaningful quality improvement for users who spot errors

---

## AWARE™ integration — schema-constrained extraction and API write

**Context:** Distil's generic MVP extracts fields freely from any uploaded files and outputs a CSV or JSON download. The AWARE™ import portal is a schema-constrained deployment of Distil — it maps extracted fields to the AWARE™ data schema and writes the confirmed payload to the AWARE™ API rather than producing a file download.

**What this looks like as a build:**
- Populate `lib/schema.ts` with the confirmed AWARE™ field schema (awaiting schema mapping work)
- Replace `/api/download` with `/api/approve` — POST resolved payload to `AWARE_API_BASE_URL`
- Add `AWARE_API_BASE_URL` and `AWARE_API_KEY` environment variables
- Update the Claude system prompt in `prompts/review.md` to reference the AWARE™ schema explicitly
- Update UI copy throughout: "Download CSV" → "Send to AWARE™", "Review your extraction" → "Review your import", etc.
- Apply AWARE™-specific branding if diverging from the Distil visual design

**Architecture note:** Distil is designed so this is a configuration and extension layer, not a fork. The core extraction, review UI, and field card components are unchanged. Only the schema, the approve route, and UI copy need updating.

**Dependency:** Confirmed AWARE™ data schema — in progress separately.

**Priority:** Required for AWARE™ production use — not Distil MVP-blocking

---

## Export screen — schema toggle and output mapping

**Context:** The MVP export screen offers CSV and JSON download with no schema mapping. The schema toggle — "Already have a structure you need to match?" — was designed but deferred from MVP to keep the build tight.

**Full design when building this:**

The toggle sits below the format picker on Screen 4, off by default. When enabled, two sub-options appear:

1. **Paste column headers** — textarea, one column name per line. Distil remaps extracted field labels to these names before generating the file. Unmatched columns are appended at the end. Missing columns are left blank.

2. **Connect a Google Sheet** — URL input. Distil reads the header row from the linked sheet and uses those column names as the target structure. Requires Google Sheets API access or a server-side fetch of the sheet's first row.

A third sub-option — **Use a platform schema** — is the AWARE™ integration path:
- User provides an AWARE™ API key
- Distil fetches the AWARE™ field schema from the API
- Output is mapped to AWARE™ field IDs
- The download button becomes "Send to AWARE™" and the confirmed payload is POSTed to the AWARE™ API rather than downloaded as a file
- This is the primary bridge between Distil as a generic tool and AWARE™ as a downstream consumer

**`/api/download` changes needed:**
- Add optional `schema` parameter (array of column name strings)
- If schema provided: remap field labels before generating output
- Add `platform` parameter for API-write path
- Handle AWARE™ API POST when platform is `aware`

**UI copy:**
- Toggle label: "Already have a structure you need to match?"
- Toggle subtext: "Paste your column headers, connect a Google Sheet, or use a platform schema — we'll match structure"

**Priority:** High post-MVP — unlocks the AWARE™ integration path and makes Distil useful for users with existing data structures

---

## Google Sheets direct export

**Context:** The export screen MVP has CSV and JSON only. Google Sheets as a direct export format was cut from MVP.

**What to build:**
- Format picker gains a third option: Google Sheets
- On select: user is prompted to authenticate with Google (OAuth)
- On confirm: Distil creates a new Google Sheet with the structured data and opens it in a new tab
- Requires Google Sheets API integration server-side

**Priority:** Post-MVP — CSV download and manual import is a viable workaround for now

---

## Plain text (.txt) and WhatsApp support — reintroduction with two-pass architecture

**Context:** Plain text and WhatsApp support were removed from the MVP because unstructured text requires too much Claude involvement relative to the quality of output. The fundamental problem is that deterministic code cannot reliably extract domain-specific values from free-form text, and passing entire files to Claude is expensive, slow, and produces inconsistent results.

The decision was made to focus the MVP on structured files (CSV, XLSX) where a deterministic profiler can do most of the work before Claude is involved. Plain text and WhatsApp are deferred until the two-pass architecture described below is properly built.

**Why this is worth building:**
Plain text notes, meeting reports, and WhatsApp exports are exactly where real-world production data lives for non-technical users. A factory manager's data is more likely to be in a WhatsApp thread than a spreadsheet. This is a high-value input type that needs a better architecture to handle well.

**Current implementation (as of MVP):**

The following files exist in the codebase and should be used as the starting point:

- `lib/parsers/whatsapp.ts` — fully implemented. Handles both iOS (`DD/MM/YYYY, HH:MM`) and Android (`M/D/YY, HH:MM AM/PM`) export formats. Detects WhatsApp format via `DETECT_RE` pattern on first 50 lines. Falls back to plain text via `parseTxt()` for non-WhatsApp `.txt` files. Exports `parseWhatsApp`, `parseTxt`, `TxtParseResult`, `PlainTextParseResult`.
- `app/api/extract/route.ts` — `serializePlainText()` function exists, passes raw content to Claude under a `(Plain Text)` header. This is the function to replace with the two-pass approach.
- `prompts/review.md` — the Claude system prompt. Currently written for generic extraction. Will need a separate prompt variant for Pass 1 (observation/characterisation) vs Pass 2 (interpretation).

**The two-pass architecture to build:**

**Pass 0 — Claude observation pass (cheap, fast)**
A separate lightweight Claude call that receives the raw file content and outputs a structured JSON characterisation:

```json
{
  "fileType": "supplier visit notes",
  "domain": "textile manufacturing",
  "domainEntities": [
    { "name": "batch reference", "pattern": "STM-YYYY-XXXX" },
    { "name": "certification", "examples": ["BSCI 2023", "GOTS"] },
    { "name": "weight", "unit": "kg" }
  ],
  "dateFormat": "DD Month YYYY",
  "knownSources": ["Ahmed Raza", "Leila"],
  "structuralPatterns": ["Key: Value lines present", "WhatsApp messages present"]
}
```

This call should use a short, focused system prompt instructing Claude to characterise only — no extraction, no judgment. Max tokens should be low (512). This is the cheap planning step.

**Pass 1 — Deterministic code extraction**
Using the characterisation from Pass 0, the code runs targeted extraction:
- Universal entities (always): dates, emails, phone numbers, URLs, currencies, measurements with standard units
- Domain entities (from Pass 0): batch references matching the detected pattern, certifications matching known names, etc.
- Structural patterns (from Pass 0): Key:Value line parsing if detected, WhatsApp message parsing if detected
- Uncertainty detection: values adjacent to `~`, `approx`, `estimated`, `TBC`, `outstanding`
- Conflict detection: same entity type appearing with different values (e.g. two weight measurements)

Output: structured extraction result with clean values, flagged values, and unresolved text separated.

**Pass 2 — Claude interpretation pass**
Claude receives the Pass 0 characterisation plus the Pass 1 structured output. It only processes:
- Values flagged as uncertain by the code
- Conflicts detected by the code where the correct value requires judgment
- Unresolved text that yielded no structured extractions

Claude does not receive the full raw file. It receives an organised payload of genuinely hard problems with prior context already established.

**System prompt variants needed:**
- `prompts/observe.md` — Pass 0 prompt. Instructs Claude to characterise only, output JSON, no extraction.
- `prompts/review.md` — existing, update to accept Pass 0 context as additional input parameter.

**New files to create:**
- `lib/parsers/plaintext.ts` — deterministic extraction for plain text using Pass 0 characterisation as input
- `lib/passes/observe.ts` — Pass 0 Claude call, returns characterisation JSON
- Update `lib/parsers/whatsapp.ts` — integrate with Pass 1 extraction pipeline

**Integration point:**
In `app/api/extract/route.ts`, the `.txt` branch currently calls `parseTxt()` then `serializePlainText()`. Replace with:
1. Call `observe()` from `lib/passes/observe.ts`
2. Call `extractPlainText(content, characterisation)` from `lib/parsers/plaintext.ts`
3. Pass structured output to Claude's interpretation pass as with CSV/XLSX

**Open questions:**
- Pass 0 adds latency. For a 20-40 second processing screen, adding another 3-5 seconds is probably acceptable but should be measured.
- Should WhatsApp exports use the same two-pass architecture or is the existing deterministic parser sufficient given the structured format?
- How do we handle files that Pass 0 cannot characterise (too short, too ambiguous, no recognisable domain)?

**Priority:** High post-profiler — this is the next major feature after the profiler is stable

---

## Profiler — cross-file conflict detection

**Context:** The profiler analyses each file independently. When a user uploads multiple CSV or XLSX files, conflicts between files — the same value appearing differently across sources — are not detected. This was deferred from the initial profiler build.

**What to build:**
After all files have been profiled individually, a cross-file pass compares columns with the same name across files. For each shared column name, check whether the same identifier (matched via primary key column from `FileCharacterisation`) has different values in different files. Flag as a `cross_file_conflict` with both source files, both values, and the row locations.

**Integration point:**
In `app/api/extract/route.ts`, after all `ProfilerResult` objects are produced, pass them to a new `lib/profiler-cross.ts` module that returns additional `ProfilerFlag` objects with type `cross_file_conflict`. These merge into the flagged issues sent to Claude in Pass 2.

**Priority:** Post-MVP — add when users report conflicts not being caught across multiple uploaded files
