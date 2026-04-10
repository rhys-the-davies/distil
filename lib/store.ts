// In-memory client-side store for cross-screen state.
// Files cannot be serialised to sessionStorage, so we hold them here for
// the upload → processing handoff. This lives only for the browser tab session.
// The spec permits sessionStorage only for the screen 3 → 4 payload.

import type { ExtractionPayload, ColumnReview } from '@/types/field'

let pendingFiles: File[] = []
let extractionPayload: ExtractionPayload | null = null
let columnReviewStore: ColumnReview[] = []
let sessionId: string | null = null

export function setPendingFiles(files: File[]) {
  pendingFiles = files
}

export function getPendingFiles(): File[] {
  return pendingFiles
}

export function clearPendingFiles() {
  pendingFiles = []
}

export function setExtractionPayload(payload: ExtractionPayload) {
  extractionPayload = payload
}

export function getExtractionPayload(): ExtractionPayload | null {
  return extractionPayload
}

export function setSessionId(id: string): void {
  sessionId = id
}

export function getSessionId(): string | null {
  return sessionId
}

export function setColumnReviews(reviews: ColumnReview[]): void {
  columnReviewStore = reviews
}

export function getColumnReviews(): ColumnReview[] {
  return columnReviewStore
}

export function clearAll() {
  pendingFiles = []
  extractionPayload = null
  columnReviewStore = []
  sessionId = null
}
