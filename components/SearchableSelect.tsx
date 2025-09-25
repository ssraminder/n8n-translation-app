"use client"
import { useEffect, useMemo, useRef, useState } from 'react'

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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const valStr = value === undefined ? '' : String(value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = options || []
    return q ? list.filter(o => o.label.toLowerCase().includes(q)) : list
  }, [options, query])

  const selectedLabel = useMemo(() => {
    const hit = options.find(o => String(o.value) === valStr)
    return hit?.label || ''
  }, [options, valStr])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!open) return
    setHighlight(0)
  }, [open, query])

  function commitSelect(opt?: Option) {
    if (allowEmpty && !opt) {
      onChange('')
      setQuery('')
      setOpen(false)
      return
    }
    if (!opt) return
    onChange(String(opt.value))
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, (allowEmpty ? filtered.length : filtered.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allowEmpty && highlight === 0) {
        if (query.length === 0) commitSelect(undefined)
        else commitSelect(filtered[0])
      } else {
        const idx = allowEmpty ? highlight - 1 : highlight
        commitSelect(filtered[idx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-400'}`}>{selectedLabel || 'Select...'}</span>
        <svg className="ml-2 h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd"/></svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-200">
            <input
              autoFocus
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder={placeholder || 'Search...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {allowEmpty && (
              <li
                role="option"
                aria-selected={valStr === ''}
                className={`px-3 py-2 text-sm cursor-pointer ${highlight === 0 ? 'bg-blue-50' : ''}`}
                onMouseEnter={() => setHighlight(0)}
                onClick={() => commitSelect(undefined)}
              >
                Clear selection
              </li>
            )}
            {(filtered.length ? filtered : [{ value: '__no__', label: 'No results' }]).map((opt, i) => {
              const idx = allowEmpty ? i + 1 : i
              const disabledOpt = opt.value === '__no__'
              return (
                <li
                  key={String(opt.value)}
                  role="option"
                  aria-disabled={disabledOpt}
                  aria-selected={String(opt.value) === valStr}
                  className={`px-3 py-2 text-sm flex items-center gap-2 ${disabledOpt ? 'text-gray-400' : 'cursor-pointer'} ${highlight === idx ? 'bg-blue-50' : ''}`}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => !disabledOpt && commitSelect(opt)}
                >
                  <span className="inline-block h-3 w-3 rounded-sm bg-indigo-200"></span>
                  <span className="truncate">{opt.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
