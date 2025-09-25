"use client"
import { useEffect, useRef, useState } from 'react'
import { useLucide } from './useLucide'

const STEPS = [
  { id: 'analyzing', label: 'Analyzing your documents...', duration: 2000 },
  { id: 'counting', label: 'Counting billable pages...', duration: 3000 },
  { id: 'calculating', label: 'Calculating your quote...', duration: 2500 },
  { id: 'finalizing', label: 'Finalizing quote details...', duration: 2000 },
]

export function ProcessingOverlay({ open, onDone, mode = 'process' }: { open: boolean; onDone: () => void; mode?: 'upload' | 'process' }) {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const timer = useRef<any>(null)
  useLucide([open, current, mode])

  useEffect(()=>{
    if (!open) return
    setCurrent(0)
    setProgress(0)
    runStep(0, 0)
    return () => { if (timer.current) clearTimeout(timer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const UPLOAD_STEPS = [
    { id: 'uploading', label: 'Uploading file(s)...', duration: 2000 },
    { id: 'saving', label: 'Saving file information...', duration: 1500 },
  ]
  const PROCESS_STEPS = STEPS
  function runStep(index: number, acc: number) {
    if (!open) return
    const active = mode === 'upload' ? UPLOAD_STEPS : PROCESS_STEPS
    if (index >= active.length) {
      setProgress(100)
      timer.current = setTimeout(()=> onDone(), 800)
      return
    }
    setCurrent(index)
    const inc = Math.round(100 / active.length)
    setProgress(acc + inc)
    timer.current = setTimeout(()=> runStep(index+1, acc+inc), active[index].duration)
  }

  return (
    <div className={(open ? '' : 'hidden ') + 'fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50'}>
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-20 h-20 mb-8">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
        </div>
        <div className="space-y-4">
          {(mode === 'upload' ? UPLOAD_STEPS : PROCESS_STEPS).map((s, i)=> (
            <div key={s.id} className={'flex items-center justify-center space-x-3 ' + (i <= current ? '' : 'opacity-50')}>
              <div className={i <= current ? 'w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center' : 'w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center'}>
                {i < current ? (<i data-lucide="check" className="w-4 h-4 text-white"></i>) : (<div className={i === current ? 'w-2 h-2 bg-blue-600 rounded-full animate-pulse' : 'w-2 h-2 bg-gray-300 rounded-full'}></div>)}
              </div>
              <span className={'text-lg font-medium ' + (i <= current ? 'text-gray-900' : 'text-gray-600')}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-gray-600 mb-2">This usually takes 10-15 seconds</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: progress + '%' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
