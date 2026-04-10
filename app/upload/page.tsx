'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DropZone from '@/components/DropZone'
import ModePicker from '@/components/ModePicker'
import { setPendingFiles, setSessionId, setMode as setModeInStore } from '@/lib/store'
import type { DistilMode } from '@/types/field'

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<DistilMode>('find-issues')
  const router = useRouter()

  // Generate a fresh session ID each time the upload screen mounts.
  // This clears any prior session when the user starts over.
  useEffect(() => {
    setSessionId(crypto.randomUUID())
  }, [])

  function handleModeChange(newMode: DistilMode) {
    setMode(newMode)
    setFiles([])
  }

  const acceptedFormats =
    mode === 'structure'
      ? ['.xlsx', '.xls', '.csv', '.txt']
      : ['.xlsx', '.xls', '.csv']

  const rejectionMessage =
    mode === 'structure'
      ? 'Supported: CSV, Excel, and plain text (.txt) files.'
      : 'Only CSV and Excel files are supported in Find issues mode.'

  const canProceed = files.length > 0

  function handleExtract() {
    if (!canProceed) return
    setModeInStore(mode)
    setPendingFiles(files)
    router.push('/processing')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-snow)',
      }}
    >
      {/* Content column */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '680px',
          margin: '0 auto',
          padding: '48px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Wordmark */}
        <div style={{ marginBottom: '56px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: '22px',
              letterSpacing: 'var(--letter-spacing-display)',
              color: 'var(--color-scarlet)',
            }}
          >
            Distil
          </span>
        </div>

        {/* Page heading */}
        <h1
          className="heading-display"
          style={{
            fontSize: '32px',
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}
        >
          Add your files
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: 'var(--color-text-muted)',
            marginBottom: '40px',
            lineHeight: 1.6,
          }}
        >
          Upload your files and Distil will find issues, clean, or structure
          your data — depending on the mode you choose.
        </p>

        {/* Export instructions */}
        <div
          className="card"
          style={{ padding: 0, marginBottom: '24px', overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '0.5px solid var(--color-border-default)',
            }}
          >
            <p className="label" style={{ marginBottom: '0' }}>
              Supported file formats
            </p>
          </div>

          {/* Excel and CSV */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '0.5px solid var(--color-border-default)',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              Excel and CSV
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.65,
              }}
            >
              Export from Excel, Google Sheets, or any system that produces{' '}
              <code style={{ fontFamily: 'var(--font-body)', background: 'rgba(41,8,0,0.06)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>.xlsx</code>{' '}
              or{' '}
              <code style={{ fontFamily: 'var(--font-body)', background: 'rgba(41,8,0,0.06)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>.csv</code>{' '}
              files. Drop the file directly — no preparation needed.
            </p>
          </div>

          {/* Plain text and WhatsApp */}
          <div style={{ padding: '16px 20px' }}>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              Plain text and WhatsApp{' '}
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                (Structure mode only)
              </span>
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.65,
              }}
            >
              WhatsApp: open the chat → tap the name → Export chat → Without
              media → save the{' '}
              <code style={{ fontFamily: 'var(--font-body)', background: 'rgba(41,8,0,0.06)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>.txt</code>{' '}
              file. Notes and documents: save as{' '}
              <code style={{ fontFamily: 'var(--font-body)', background: 'rgba(41,8,0,0.06)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px' }}>.txt</code>{' '}
              and upload directly.
            </p>
          </div>
        </div>

        {/* Mode picker */}
        <ModePicker selected={mode} onChange={handleModeChange} />

        {/* Drop zone */}
        <DropZone
          files={files}
          onFilesChange={setFiles}
          acceptedExtensions={acceptedFormats}
          rejectionMessage={rejectionMessage}
        />

        {/* CTA */}
        <div style={{ marginTop: '24px' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceed}
            onClick={handleExtract}
            style={{ width: '100%', padding: '13px 20px', fontSize: '15px' }}
          >
            Extract data →
          </button>
        </div>
      </main>
    </div>
  )
}
