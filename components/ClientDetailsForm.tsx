"use client"
import { useState, useEffect } from 'react'

export type ClientDetails = {
  fullName: string
  email: string
  phone: string
  orderType: 'personal' | 'business'
  companyName?: string
  frequency?: string
}

export function ClientDetailsForm({ value, onChange, onContinue }: {
  value: ClientDetails
  onChange: (v: ClientDetails) => void
  onContinue: () => void
}) {
  const [local, setLocal] = useState<ClientDetails>(value)

  useEffect(()=>{ setLocal(value) }, [value])

  function update<K extends keyof ClientDetails>(key: K, val: ClientDetails[K]) {
    const next = { ...local, [key]: val }
    setLocal(next)
    onChange(next)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
          <input type="text" value={local.fullName} onChange={(e)=>update('fullName', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your full name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
          <input type="email" value={local.email} onChange={(e)=>update('email', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your@email.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
          <input type="tel" value={local.phone} onChange={(e)=>update('phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+1 (555) 123-4567" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Type *</label>
          <select value={local.orderType} onChange={(e)=>update('orderType', e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="personal">Personal</option>
            <option value="business">Business</option>
          </select>
        </div>
      </div>

      {local.orderType === 'business' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input type="text" value={local.companyName || ''} onChange={(e)=>update('companyName', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your company name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Translation Frequency</label>
            <select value={local.frequency || 'First time'} onChange={(e)=>update('frequency', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>First time</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Annually</option>
              <option>As needed</option>
            </select>
          </div>
        </div>
      )}

      <button onClick={onContinue} className="mt-8 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Continue to Verification</button>
    </div>
  )
}
