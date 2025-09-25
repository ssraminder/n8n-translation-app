"use client"
import { useState, useEffect } from 'react'

export type OrderOptions = {
  speed: 'standard' | 'rush' | 'same-day'
  delivery: 'email' | 'pickup' | 'post' | 'courier'
  billing: { street: string; city: string; province: string; postal: string }
  deliveryAddr?: { street: string; city: string; province: string; postal: string }
}

export function OrderOptionsForm({ value, onChange, showDeliveryAddress, onToggleDeliveryVisibility }: {
  value: OrderOptions
  onChange: (v: OrderOptions) => void
  showDeliveryAddress: boolean
  onToggleDeliveryVisibility: (show: boolean) => void
}) {
  const [local, setLocal] = useState<OrderOptions>(value)
  useEffect(()=>{ setLocal(value) }, [value])

  function update<K extends keyof OrderOptions>(key: K, val: OrderOptions[K]) {
    const next = { ...local, [key]: val }
    setLocal(next)
    onChange(next)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Options</h3>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Turnaround Time</label>
        <select
          value={local.speed}
          onChange={(e)=>update('speed', e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="standard">Standard (3-5 business days) - Included</option>
          <option value="rush">Rush (1-2 business days) - +$44.98</option>
          <option value="same-day">Same Day - +$89.95</option>
        </select>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Method</label>
        <select
          value={local.delivery}
          onChange={(e)=>{
            const v = e.target.value as any
            update('delivery', v)
            onToggleDeliveryVisibility(v === 'post' || v === 'courier')
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="email">Scanned PDF via Email - Free</option>
          <option value="pickup">Pickup in Calgary Downtown - Free</option>
          <option value="post">Canada Post - +$15.00</option>
          <option value="courier">Courier Delivery - +$25.00</option>
        </select>
      </div>
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">Billing Address</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={local.billing.street} onChange={(e)=>update('billing', { ...local.billing, street: e.target.value })} type="text" placeholder="Street Address" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={local.billing.city} onChange={(e)=>update('billing', { ...local.billing, city: e.target.value })} type="text" placeholder="City" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={local.billing.province} onChange={(e)=>update('billing', { ...local.billing, province: e.target.value })} type="text" placeholder="Province" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={local.billing.postal} onChange={(e)=>update('billing', { ...local.billing, postal: e.target.value })} type="text" placeholder="Postal Code" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {showDeliveryAddress && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-medium text-gray-900">Delivery Address</h4>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" onChange={(e)=>{
                if (e.target.checked) {
                  update('deliveryAddr', { ...local.billing })
                }
              }} />
              <span className="text-sm text-gray-600">Same as billing</span>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={local.deliveryAddr?.street || ''} onChange={(e)=>update('deliveryAddr', { ...(local.deliveryAddr||{street:'',city:'',province:'',postal:''}), street: e.target.value })} type="text" placeholder="Street Address" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={local.deliveryAddr?.city || ''} onChange={(e)=>update('deliveryAddr', { ...(local.deliveryAddr||{street:'',city:'',province:'',postal:''}), city: e.target.value })} type="text" placeholder="City" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={local.deliveryAddr?.province || ''} onChange={(e)=>update('deliveryAddr', { ...(local.deliveryAddr||{street:'',city:'',province:'',postal:''}), province: e.target.value })} type="text" placeholder="Province" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={local.deliveryAddr?.postal || ''} onChange={(e)=>update('deliveryAddr', { ...(local.deliveryAddr||{street:'',city:'',province:'',postal:''}), postal: e.target.value })} type="text" placeholder="Postal Code" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}
    </div>
  )
}
