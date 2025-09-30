"use client"

export type StepIndex = 1 | 2 | 3 | 4 | 5

const STEP_LABELS: Record<StepIndex, string> = {
  1: 'Upload',
  2: 'Details',
  3: 'Quote',
  4: 'Order & Pay',
  5: 'Confirmation',
}

export function ProgressBar({ step }: { step: StepIndex }) {
  const clamped = Math.min(5, Math.max(1, step)) as StepIndex
  const percent = ((clamped - 1) / 4) * 100
  const label = STEP_LABELS[clamped]

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="relative">
          <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden" aria-label={`Progress: Step ${clamped} of 5`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-gray-700 bg-white/80 px-3 py-0.5 rounded-full">
              Step {clamped} of 5 — {label}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
