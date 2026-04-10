'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepFeed, { type Step } from '@/components/StepFeed'
import { getPendingFiles, getSessionId, getMode, setExtractionPayload, clearAll } from '@/lib/store'
import type { ExtractionPayload } from '@/types/field'

// ── Error classification ─────────────────────────────────────────────────────

const CONTACT = 'If this keeps happening, contact rhys@studiorhys.com'

function classifyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  const lower = message.toLowerCase()

  // JSON / response-parse errors — covers both client-side SyntaxError and
  // server-side messages forwarded from the Claude response parser.
  if (
    name === 'SyntaxError' ||
    lower.includes('json') ||
    lower.includes('unexpected token') ||
    lower.includes('unterminated') ||
    lower.includes('parse error') ||
    lower.includes("missing \"fields\"")
  ) {
    return `We couldn't read the response from the AI. Try again — if it keeps happening, try a smaller file. ${CONTACT}`
  }

  // Network / timeout errors — fetch throws TypeError on network failure.
  if (
    name === 'TypeError' ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('connection')
  ) {
    return `The request timed out. Check your connection and try again. ${CONTACT}`
  }

  // Catch-all
  return `Something went wrong during extraction. Try again or start over with a different file. ${CONTACT}`
}

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { label: 'Reading your files' },
  { label: 'Parsing content' },
  { label: 'Extracting data fields', detail: 'Identifying all recognisable fields' },
  { label: 'Cross-referencing sources', detail: 'Checking for conflicts across files' },
  { label: 'Assessing quality', detail: 'Flagging issues for review' },
  { label: 'Preparing results' },
]

// Steps 0–4 auto-advance on a fixed schedule spread across 60% of an estimated
// 15 s Claude response time. Step 5 (last) stays active until the API responds.
// If the API responds earlier, snapToComplete() rapidly finishes remaining steps.
const STEP_DELAYS_MS = [0, 1800, 3600, 5400, 7200, 9000]
const SNAP_INTERVAL_MS = 250

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProcessingPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  // Incrementing sessionKey cleanly restarts both animation and API effects on retry.
  const [sessionKey, setSessionKey] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [animationAtEnd, setAnimationAtEnd] = useState(false)
  const [result, setResult] = useState<ExtractionPayload | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Refs avoid stale closures when reading animation state inside async callbacks.
  const stepTimerIds = useRef<ReturnType<typeof setTimeout>[]>([])
  const currentStepRef = useRef(0)
  const animationAtEndRef = useRef(false)

  // Advance to a specific step index, updating both the ref and state.
  function advanceToStep(n: number) {
    currentStepRef.current = n
    setCurrentStep(n)
    if (n >= STEPS.length - 1) {
      animationAtEndRef.current = true
      setAnimationAtEnd(true)
    }
  }

  // Called the moment the API resolves (success or error).
  // If the animation has already finished, nothing to do — React will compute
  // showCompletion=true on the next render naturally.
  // If the animation is still running, cancel pending step timers and
  // rapidly advance the remaining steps at SNAP_INTERVAL_MS each.
  const snapToComplete = useCallback(() => {
    if (animationAtEndRef.current) return

    stepTimerIds.current.forEach(clearTimeout)
    stepTimerIds.current = []

    const stepNow = currentStepRef.current
    const remaining = STEPS.length - 1 - stepNow

    if (remaining <= 0) {
      animationAtEndRef.current = true
      setAnimationAtEnd(true)
      return
    }

    const snapTimers = Array.from({ length: remaining }, (_, i) => {
      const target = stepNow + i + 1
      return setTimeout(() => {
        currentStepRef.current = target
        setCurrentStep(target)
        if (target >= STEPS.length - 1) {
          animationAtEndRef.current = true
          setAnimationAtEnd(true)
        }
      }, (i + 1) * SNAP_INTERVAL_MS)
    })

    stepTimerIds.current = snapTimers
  }, [])

  // Guard: redirect to upload if no files in store (direct navigation)
  useEffect(() => {
    const pending = getPendingFiles()
    if (pending.length === 0) {
      router.replace('/upload')
      return
    }
    setFiles(pending)
  }, [router])

  // Animation timeline — re-runs on retry (sessionKey increment)
  useEffect(() => {
    currentStepRef.current = 0
    animationAtEndRef.current = false
    setCurrentStep(0)
    setAnimationAtEnd(false)

    const timers = STEP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => advanceToStep(i), delay)
    )
    stepTimerIds.current = timers

    return () => {
      // Cancel both regular step timers and any active snap timers
      stepTimerIds.current.forEach(clearTimeout)
      stepTimerIds.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  // API call — fires when files load; restarts cleanly on retry via sessionKey
  useEffect(() => {
    if (files.length === 0) return

    const controller = new AbortController()

    async function callExtract() {
      const formData = new FormData()
      for (const f of files) formData.append('files', f)
      const sid = getSessionId()
      if (sid) formData.append('sessionId', sid)
      formData.append('mode', getMode())

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(json.error ?? `Server error ${res.status}`)
        }
        const payload = (await res.json()) as ExtractionPayload
        snapToComplete()
        setResult(payload)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        snapToComplete()
        setApiError(classifyError(err))
      }
    }

    callExtract()
    return () => controller.abort()
  }, [files, sessionKey, snapToComplete])

  // ── Derived state ───────────────────────────────────────────────────────────

  const apiDone = result !== null || apiError !== null
  const showCompletion = animationAtEnd && apiDone
  const allStepsComplete = showCompletion && !apiError

  function handleReview() {
    if (!result) return
    setExtractionPayload(result)
    router.push('/review')
  }

  function handleRetry() {
    setResult(null)
    setApiError(null)
    setSessionKey((k) => k + 1)
  }

  function handleStartOver() {
    clearAll()
    router.push('/upload')
  }

  function summaryText(): string {
    if (!result) return ''
    const actionCount =
      result.summary.conflicts +
      result.summary.missingRequired +
      result.summary.warnings
    if (actionCount === 0) return 'All fields extracted cleanly'
    return `Review ready — ${actionCount} item${actionCount !== 1 ? 's' : ''} need your attention`
  }

  const displayStep = allStepsComplete ? STEPS.length : currentStep

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-snow)',
      }}
    >
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        {/* Card */}
        <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
          {/* Wordmark */}
          <div style={{ marginBottom: '28px' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: '18px',
                letterSpacing: 'var(--letter-spacing-display)',
                color: 'var(--color-scarlet)',
              }}
            >
              Distil
            </span>
          </div>

          {/* Heading */}
          <h1
            className="heading-display"
            style={{ fontSize: '22px', color: 'var(--color-text-primary)', marginBottom: '6px' }}
          >
            Processing your data
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '28px' }}>
            {files.length > 0
              ? `${files.length} file${files.length !== 1 ? 's' : ''} · please don't close this tab`
              : 'Loading files…'}
          </p>

          <div className="divider" style={{ margin: '0 0 20px' }} />

          {/* Step feed */}
          <StepFeed
            steps={STEPS}
            currentStep={displayStep}
            errorStep={showCompletion && apiError ? STEPS.length - 1 : undefined}
          />

          {!showCompletion && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                marginTop: '20px',
                lineHeight: 1.5,
              }}
            >
              This usually takes 20–40 seconds — feel free to grab a coffee.
            </p>
          )}

          {/* Completion area — fades in once all steps done + API resolved */}
          {showCompletion && (
            <div className="animate-fade-in" style={{ marginTop: '28px' }}>
              <div className="divider" style={{ margin: '0 0 20px' }} />

              {apiError ? (
                <>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-scarlet)',
                      marginBottom: '4px',
                    }}
                  >
                    Extraction failed
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                      marginBottom: '16px',
                      lineHeight: 1.5,
                    }}
                  >
                    {apiError}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleRetry}
                      style={{ flex: 1 }}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleStartOver}
                    >
                      Start over
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      marginBottom: '16px',
                    }}
                  >
                    {summaryText()}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleReview}
                    style={{ width: '100%', padding: '13px 20px', fontSize: '15px' }}
                  >
                    Review results →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Start over link */}
        <button
          type="button"
          className="btn-tertiary"
          onClick={handleStartOver}
          style={{ marginTop: '24px', fontSize: '12px' }}
        >
          Start over
        </button>
      </main>
    </div>
  )
}
