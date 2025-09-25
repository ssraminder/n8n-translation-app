"use client"
import { useMemo, useState } from 'react'

export type Option = { value: string | number; label: string }

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  allowEmpty,
}: {
  label: string
  options: Option[]
  value: string | number | undefined
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = options || []
    const filtered = q ? list.filter(o => o.label.toLowerCase().includes(q)) : list
    return filtered
  }, [options, query])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e)=>setQuery(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={disabled}
      />
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value === undefined ? '' : String(value)}
        onChange={(e)=> onChange(e.target.value)}
        disabled={disabled}
      >
        {allowEmpty && <option value="">Select...</option>}
        {filtered.map(opt => (
          <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
