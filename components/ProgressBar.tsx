"use client"
import { useLucide } from './useLucide'

export type StepIndex = 1 | 2 | 3 | 4 | 5

export function ProgressBar({ step }: { step: StepIndex }) {
  useLucide([step])
  const stepItem = (n: number, label: string, active: boolean) => (
    <div className="flex items-center">
      <div className={
        `w-8 h-8 ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'} rounded-full flex items-center justify-center text-sm font-medium`
      }>{n}</div>
      <span className={"ml-2 text-sm font-medium " + (active ? 'text-blue-600' : 'text-gray-500')}>{label}</span>
    </div>
  )
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {stepItem(1, 'Upload', step >= 1)}
            <div className="w-8 sm:w-16 h-0.5 bg-gray-200"></div>
            {stepItem(2, 'Details', step >= 2)}
            <div className="w-8 sm:w-16 h-0.5 bg-gray-200"></div>
            {stepItem(3, 'Quote', step >= 3)}
            <div className="w-8 sm:w-16 h-0.5 bg-gray-200"></div>
            {stepItem(4, 'Order & Pay', step >= 4)}
          </div>
        </div>
      </div>
    </div>
  )
}
