"use client"
import { useEffect, useState } from 'react'

export function CheckoutOptions({ quoteId, amountCents }: { quoteId: string; amountCents: number }) {
  const [options, setOptions] = useState<{ id: string; name: string; available: boolean; reason: string | null; fee_cents: number }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    async function load(){
      const r = await fetch(`/api/delivery/options?quote_id=${encodeURIComponent(quoteId)}`)
      if (r.ok){
        const data = await r.json()
        setOptions(data.options || [])
      }
    }
    load()
  }, [quoteId])

  async function updateDelivery(id: string){
    setSelected(id)
    await fetch('/api/quote/update-delivery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId, delivery_option_id: id }) })
  }

  async function pay(){
    setLoading(true)
    try{
      const fee = options.find(o=>o.id===selected)?.fee_cents || 0
      const r = await fetch('/api/checkout/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId, amount_cents: amountCents, delivery_fee_cents: fee }) })
      if (!r.ok) throw new Error('CHECKOUT_FAILED')
      const { url } = await r.json()
      if (url) window.location.href = url
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-md font-semibold mb-3">Turnaround Options</h3>
        <div className="space-y-2">
          {options.map(opt => (
            <label key={opt.id} className={`flex items-center justify-between p-3 border rounded-md ${!opt.available ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="delivery" disabled={!opt.available} checked={selected===opt.id} onChange={()=>updateDelivery(opt.id)} />
                <span className="font-medium">{opt.name}</span>
              </div>
              <div className="text-sm text-gray-600">{opt.fee_cents ? `+$${(opt.fee_cents/100).toFixed(2)}` : 'Free'}</div>
            </label>
          ))}
        </div>
      </div>
      <button onClick={pay} disabled={loading} className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">Pay Securely</button>
    </div>
  )
}
