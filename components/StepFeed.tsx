'use client'

import StatusRow, { type StepState } from './StatusRow'

export interface Step {
  label: string
  detail?: string
}

interface StepFeedProps {
  steps: Step[]
  // Index of the currently active step.
  // Steps below: complete. Steps above: pending. Equal: active.
  // When === steps.length, all steps are complete.
  currentStep: number
  // If set, the last step transitions to error instead of complete.
  errorStep?: number
}

export default function StepFeed({ steps, currentStep, errorStep }: StepFeedProps) {
  return (
    <div>
      {steps.map((step, i) => {
        let state: StepState
        if (errorStep === i) {
          state = 'error'
        } else if (i < currentStep) {
          state = 'complete'
        } else if (i === currentStep) {
          state = 'active'
        } else {
          state = 'pending'
        }

        const isLast = i === steps.length - 1
        return (
          <div key={i}>
            <StatusRow
              label={step.label}
              detail={step.detail}
              state={state}
            />
            {!isLast && (
              <div
                style={{
                  borderTop: '0.5px solid var(--color-border-default)',
                  marginLeft: '30px',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
