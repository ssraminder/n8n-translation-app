"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuoteActions({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<'email'|'hitl'|'accept'|null>(null)

  async function emailQuote() {
    setLoading('email')
    try {
      const r = await fetch('/api/quote/email-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId, to: email }) })
      if (!r.ok) throw new Error('EMAIL_FAILED')
      alert('Quote email sent')
    } catch(e){ console.error(e); alert('Failed sending email') } finally { setLoading(null) }
  }
  async function requestHITL() {
    setLoading('hitl')
    try {
      const r = await fetch('/api/quote/request-hitl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId }) })
      if (!r.ok) throw new Error('HITL_FAILED')
      alert('Requested human review')
    } catch(e){ console.error(e); alert('Failed to request review') } finally { setLoading(null) }
  }

  return (
    <div className="mt-6 space-y-4">
      <button onClick={()=>router.push(`/checkout/${quoteId}`)} disabled={loading!==null} className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">Accept & Proceed</button>
      <div className="flex items-center gap-2">
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Enter email" className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={emailQuote} disabled={!email || loading!==null} className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">Email Quote</button>
      </div>
      <button onClick={requestHITL} disabled={loading!==null} className="w-full text-blue-600 hover:text-blue-800 hover:underline font-medium">Request Human Review</button>
    </div>
  )
}
