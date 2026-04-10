// WhatsApp .txt parser — handles iOS and Android export formats
//
// iOS:     DD/MM/YYYY, HH:MM[:SS] - Sender: Message
// Android: M/D/YY, H:MM AM/PM - Sender: Message
//
// Both variants use a date, comma, time, space-dash-space, sender-colon, message.
// Continuation lines (no timestamp) are appended to the previous message.
//
// If the file does not match the WhatsApp format, parseTxt() falls back to
// returning the raw content as a plain-text block for Claude to interpret.

export interface WhatsAppMessage {
  timestamp: string  // ISO 8601 local time
  sender: string
  text: string
}

export interface WhatsAppParseResult {
  type: 'whatsapp'
  messages: WhatsAppMessage[]
  participants: string[]
  totalMessages: number
}

export interface PlainTextParseResult {
  type: 'plaintext'
  content: string
}

export type TxtParseResult = WhatsAppParseResult | PlainTextParseResult

// Detects the WhatsApp timestamp prefix: "DD/MM/YYYY, HH:MM" or "M/D/YY, H:MM"
// Scans only the first 50 lines for performance on large files.
const DETECT_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}/m

function isWhatsAppExport(text: string): boolean {
  const sample = text.split(/\r?\n/).slice(0, 50).join('\n')
  return DETECT_RE.test(sample)
}

// Smart wrapper: detects format and delegates accordingly.
export function parseTxt(text: string): TxtParseResult {
  if (isWhatsAppExport(text)) {
    return parseWhatsApp(text)
  }
  return { type: 'plaintext', content: text }
}

const MAX_MESSAGES = 500

// Matches both 24-hour and 12-hour variants
// Groups: (1) day/month/year  (2) time string e.g. "14:32", "14:32:09", "2:32 PM"
//         (3) sender          (4) message text
const LINE_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{1,2}:\d{2}(?::\d{2})?(?:\u202F?[AP]M)?)\s[-\u2013]\s(.+?):\s(.+)$/i

function parseTimestamp(dateStr: string, timeStr: string): string {
  const dateParts = dateStr.split('/')
  if (dateParts.length !== 3) return `${dateStr} ${timeStr}`

  let [a, b, c] = dateParts

  // Determine date order: iOS uses DD/MM/YYYY, Android uses M/D/YY or M/D/YYYY
  // Heuristic: if the first segment > 12 it must be a day (iOS format)
  let day: string, month: string, year: string
  if (parseInt(a) > 12) {
    // DD/MM/YYYY (iOS)
    ;[day, month, year] = [a, b, c]
  } else {
    // M/D/YY or M/D/YYYY (Android) — ambiguous when day ≤ 12, default to Android
    ;[month, day, year] = [a, b, c]
  }

  if (year.length === 2) year = `20${year}`
  const dateNorm = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

  // Normalise time — strip narrow no-break space before AM/PM
  const timeNorm = timeStr.replace(/\u202F/g, ' ').trim()
  const ampmMatch = timeNorm.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s?([AP]M)$/i)
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1])
    const min = ampmMatch[2]
    const period = ampmMatch[3].toUpperCase()
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0
    return `${dateNorm}T${String(hour).padStart(2, '0')}:${min}:00`
  }

  // 24-hour
  const parts = timeNorm.split(':')
  const hh = parts[0].padStart(2, '0')
  const mm = parts[1] ?? '00'
  return `${dateNorm}T${hh}:${mm}:00`
}

export function parseWhatsApp(text: string): WhatsAppParseResult {
  const lines = text.split(/\r?\n/)
  const messages: WhatsAppMessage[] = []
  const senderSet = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(LINE_RE)
    if (match) {
      const [, dateStr, timeStr, sender, text] = match
      senderSet.add(sender)
      messages.push({
        timestamp: parseTimestamp(dateStr, timeStr),
        sender,
        text,
      })
    } else if (messages.length > 0) {
      // Continuation of previous message
      messages[messages.length - 1].text += '\n' + trimmed
    }
  }

  const totalMessages = messages.length

  return {
    type: 'whatsapp',
    messages: messages.slice(0, MAX_MESSAGES),
    participants: Array.from(senderSet),
    totalMessages,
  }
}
