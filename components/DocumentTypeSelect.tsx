"use client"
import { useEffect, useMemo, useState } from 'react'

export function DocumentTypeSelect({ value, onChange }: { value: { id?: number; other?: string }; onChange: (v: { id?: number; other?: string }) => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/document-types', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        const json = await res.json()
        const list: { id: number; name: string }[] = json?.document_types || []
        if (mounted) {
          setOptions(list)
          setError(null)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load document types')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const otherSelected = useMemo(() => !value.id || !options.find(o => o.id === value.id), [value.id, options])

  if (loading) return <div className="mt-4 text-sm text-gray-600">Loading document types…</div>
  if (error) return <div className="mt-4 text-sm text-red-600">{error}</div>

  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value.id ? String(value.id) : '__other__'}
        onChange={(e)=>{
          const v = e.target.value
          if (v === '__other__') onChange({ id: undefined, other: value.other || '' })
          else onChange({ id: parseInt(v,10), other: undefined })
        }}
      >
        <option value="__other__">Other</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {otherSelected && (
        <input
          type="text"
          placeholder="Describe your document type"
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.other || ''}
          onChange={(e)=> onChange({ id: undefined, other: e.target.value })}
        />
      )}
    </div>
  )
}
