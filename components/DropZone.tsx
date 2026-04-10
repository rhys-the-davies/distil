'use client'

import { useRef, useState, useCallback } from 'react'
import FileList from './FileList'

const DEFAULT_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
const MAX_FILE_SIZE = 50 * 1024 // 50 KB

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

function isTooLarge(file: File): boolean {
  return file.size > MAX_FILE_SIZE
}

interface DropZoneProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  acceptedExtensions?: string[]
  rejectionMessage?: string
}

export default function DropZone({
  files,
  onFilesChange,
  acceptedExtensions = DEFAULT_ACCEPTED_EXTENSIONS,
  rejectionMessage,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAccepted = useCallback(
    (file: File) => acceptedExtensions.includes(getExtension(file.name)),
    [acceptedExtensions]
  )

  const defaultRejectionMessage = rejectionMessage ??
    'Only CSV and Excel files are supported. Plain text and WhatsApp support is coming soon.'

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming)
      const wrongType = arr.filter((f) => !isAccepted(f))
      const tooLarge = arr.filter((f) => isAccepted(f) && isTooLarge(f))
      const accepted = arr.filter((f) => isAccepted(f) && !isTooLarge(f))

      if (tooLarge.length > 0) {
        setError(
          'This file is too large — please keep files under 50KB for now.'
        )
      } else if (wrongType.length > 0) {
        setError(defaultRejectionMessage)
      } else {
        setError(null)
      }

      if (accepted.length > 0) {
        const existingNames = new Set(files.map((f) => f.name))
        const newFiles = accepted.filter((f) => !existingNames.has(f.name))
        onFilesChange([...files, ...newFiles])
      }
    },
    [files, onFilesChange, isAccepted, defaultRejectionMessage]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files — click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: 'var(--color-white)',
          border: `1.5px dashed ${
            isDragging
              ? 'var(--color-border-active)'
              : 'var(--color-border-default)'
          }`,
          borderRadius: 'var(--radius-md)',
          padding: '40px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color var(--transition-base)',
          outline: 'none',
          userSelect: 'none',
        }}
      >
        {/* Upload icon */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            margin: '0 auto 12px',
            display: 'block',
            color: isDragging
              ? 'var(--color-scarlet)'
              : 'var(--color-text-muted)',
            transition: 'color var(--transition-base)',
          }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        <p
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            marginBottom: '4px',
          }}
        >
          Drop files here or{' '}
          <span style={{ color: 'var(--color-scarlet)' }}>browse</span>
        </p>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          {acceptedExtensions.join(' · ')}
        </p>
      </div>

      {error && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-scarlet)',
            marginTop: '8px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <FileList files={files} onRemove={handleRemove} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedExtensions.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        tabIndex={-1}
      />
    </div>
  )
}
