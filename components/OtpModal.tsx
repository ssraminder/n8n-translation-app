"use client"
import { useEffect, useRef } from 'react'
import { useLucide } from './useLucide'

export function OtpModal({ open, onVerify, onClose, onResend }: { open: boolean; onVerify: () => void; onClose: () => void; onResend: () => void }) {
  useLucide([open])
  const firstRef = useRef<HTMLInputElement>(null)
  useEffect(()=>{ if (open) setTimeout(()=>firstRef.current?.focus(), 0) }, [open])
  return (
    <div className={(open ? '' : 'hidden ') + 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'}>
      <div className="bg-white rounded-lg p-6 md:p-8 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Verify Your Identity</h3>
        <p className="text-gray-600 mb-6">We've sent a 6-digit verification code to your email and phone.</p>
        <div className="flex space-x-2 mb-6">
          {Array.from({length:6}).map((_,i)=> (
            <input key={i} ref={i===0?firstRef:undefined} type="text" maxLength={1} className="w-12 h-12 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold" />
          ))}
        </div>
        <div className="flex space-x-3">
          <button onClick={onVerify} className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Verify</button>
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">Didn't receive the code? <button onClick={onResend} className="text-blue-600 hover:underline">Resend</button></p>
      </div>
    </div>
  )
}
