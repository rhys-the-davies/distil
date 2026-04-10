'use client'

import type { ExtractionPayload } from '@/types/field'

type FileType = 'excel' | 'csv' | 'whatsapp' | 'text'

function getFileType(filename: string): FileType {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  if (ext === '.xlsx' || ext === '.xls') return 'excel'
  if (ext === '.csv') return 'csv'
  return 'whatsapp'
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TYPE_LABEL: Record<FileType, string> = {
  excel: 'EXCEL',
  csv: 'CSV',
  whatsapp: 'WHATSAPP',
  text: 'TEXT',
}

// fieldCounts is used in sidebar mode to display per-file field status summary
export interface FieldCounts {
  clean: number
  review: number
  conflict: number
  missing: number
}

interface FileListProps {
  files: File[]
  onRemove?: (index: number) => void
  // Sidebar mode: when provided, show status chips instead of remove button
  fieldCounts?: FieldCounts[]
  // filename → parse result type ('whatsapp' | 'plaintext' | etc.)
  // Overrides extension-based type detection when present
  parsedTypes?: Record<string, string>
}

function resolveFileType(file: File, parsedTypes?: Record<string, string>): FileType {
  const parsed = parsedTypes?.[file.name]
  if (parsed === 'plaintext') return 'text'
  if (parsed === 'whatsapp') return 'whatsapp'
  return getFileType(file.name)
}

export default function FileList({ files, onRemove, fieldCounts, parsedTypes }: FileListProps) {
  if (files.length === 0) return null

  const isSidebar = fieldCounts !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {files.map((file, i) => {
        const type = resolveFileType(file, parsedTypes)
        const counts = fieldCounts?.[i]
        return (
          <div
            key={`${file.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--color-white)',
              border: '0.5px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              flexWrap: isSidebar ? 'wrap' : undefined,
            }}
          >
            <span className="badge badge-type">{TYPE_LABEL[type]}</span>

            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {file.name}
            </span>

            {!isSidebar && (
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  flexShrink: 0,
                }}
              >
                {formatSize(file.size)}
              </span>
            )}

            {isSidebar && counts && (
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {counts.missing > 0 && (
                  <span className="badge badge-error">{counts.missing} missing</span>
                )}
                {counts.conflict > 0 && (
                  <span className="badge badge-warning">{counts.conflict} conflict</span>
                )}
                {counts.review > 0 && (
                  <span className="badge badge-warning">{counts.review} review</span>
                )}
                {counts.clean > 0 && (
                  <span className="badge badge-clean">{counts.clean} clean</span>
                )}
              </div>
            )}

            {!isSidebar && onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(i)
                }}
                aria-label={`Remove ${file.name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  transition: 'color var(--transition-base)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--color-scarlet)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--color-text-muted)')
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
