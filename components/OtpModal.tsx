"use client"
import { useEffect, useRef, useState } from 'react'

type OtpMethod = 'email' | 'sms'

export function OtpModal({ open, onVerify, onClose, onSend, onResend }: {
  open: boolean
  onVerify: (code: string) => void
  onClose: () => void
  onSend: (method: OtpMethod) => Promise<void> | void
  onResend: (method: OtpMethod) => Promise<void> | void
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [stage, setStage] = useState<'choose' | 'enter'>('choose')
  const [method, setMethod] = useState<OtpMethod>('email')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setDigits(['', '', '', '', '', ''])
      setStage('choose')
      setMethod('email')
    }
  }, [open])

  useEffect(() => {
    if (stage === 'enter') {
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    }
  }, [stage])

  function handleChange(idx: number, val: string) {
    const v = val.replace(/[^0-9]/g, '').slice(0, 1)
    const next = digits.slice()
    next[idx] = v
    setDigits(next)
    if (v && idx < 5) inputsRef.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputsRef.current[idx - 1]?.focus()
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) inputsRef.current[idx + 1]?.focus()
  }

  async function handleSend() {
    try {
      setSending(true)
      await onSend(method)
      setStage('enter')
    } finally {
      setSending(false)
    }
  }

  const code = digits.join('')

  return (
    <div className={(open ? '' : 'hidden ') + 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'}>
      <div className="bg-white rounded-lg p-6 md:p-8 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Verify Your Identity</h3>

        {stage === 'choose' && (
          <div>
            <p className="text-gray-600 mb-4">Choose how you want to receive your 6-digit code.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="otp-method"
                  value="email"
                  checked={method === 'email'}
                  onChange={() => setMethod('email')}
                  className="h-4 w-4"
                />
                <span className="text-gray-800">Email</span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="otp-method"
                  value="sms"
                  checked={method === 'sms'}
                  onChange={() => setMethod('sms')}
                  className="h-4 w-4"
                />
                <span className="text-gray-800">Text message (SMS)</span>
              </label>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Sending…' : 'Send code'}
              </button>
              <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {stage === 'enter' && (
          <div>
            <p className="text-gray-600 mb-6">We've sent a 6-digit verification code to your {method === 'email' ? 'email' : 'phone'}.</p>
            <div className="flex space-x-2 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digits[i]}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-12 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                />
              ))}
            </div>
            <div className="flex space-x-3">
              <button onClick={() => onVerify(code)} disabled={code.length !== 6} className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Verify</button>
              <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancel</button>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">Didn't receive the code? <button onClick={() => onResend(method)} className="text-blue-600 hover:underline">Resend</button></p>
            <button onClick={() => { setStage('choose'); setDigits(['', '', '', '', '', '']) }} className="mt-3 text-sm text-gray-500 hover:underline block mx-auto">Change method</button>
          </div>
        )}
      </div>
    </div>
  )
}
