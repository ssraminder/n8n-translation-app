"use client"

import { useEffect, useMemo, useState } from 'react'
import { SearchableSelect, type Option } from './SearchableSelect'
import { COUNTRIES } from '@/src/utils/countries'

export type LanguageState = {
  source: string
  target: string
  purpose: string
  country?: string
  targetOther?: string
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export function LanguageSelects({ value, onChange }: { value: LanguageState; onChange: (v: LanguageState) => void }) {
  const [languages, setLanguages] = useState<Option[]>([])
  const [uses, setUses] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const langRes = await fetchJSON('/api/languages') as { languages: { id: number; name: string }[] }
        const usesRes = await fetchJSON('/api/intended-uses') as { intended_uses: { id: number; name: string }[] }
        const languages = langRes.languages
        const intended_uses = usesRes.intended_uses
        if (!mounted) return
        setLanguages(languages.map((l) => ({ value: String(l.id), label: l.name })))
        setUses(intended_uses.map((u) => ({ value: String(u.id), label: u.name })))
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load options')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const sourceIsEnglish = useMemo(() => value.source?.toLowerCase() === 'english', [value.source])

  const targetOptions: Option[] = useMemo(() => {
    if (!languages.length) return []
    if (sourceIsEnglish) return languages
    const english = languages.find((l) => l.label.toLowerCase() === 'english')
    const other: Option = { value: '__other__', label: 'Other' }
    return [english, other].filter(Boolean) as Option[]
  }, [languages, sourceIsEnglish])

  const countryOptions: Option[] = useMemo(() => COUNTRIES.map((c) => ({ value: c.code, label: c.name })), [])

  if (loading) {
    return <div className="mt-8 text-sm text-gray-600">Loading options…</div>
  }
  if (error) {
    return <div className="mt-8 text-sm text-red-600">{error}</div>
  }

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
      <SearchableSelect
        label="Source Language"
        options={languages}
        value={languages.find((o) => o.label === value.source)?.value}
        onChange={(v) => {
          const selected = languages.find((o) => String(o.value) === v)?.label || ''
          const next: LanguageState = { ...value, source: selected }
          if (!sourceIsEnglish) {
            // Reset target when changing away from English to ensure valid options
            next.target = ''
            next.targetOther = ''
          }
          onChange(next)
        }}
        allowEmpty
      />

      <div>
        <SearchableSelect
          label="Target Language"
          options={targetOptions}
          value={targetOptions.find((o) => o.label === value.target)?.value || (value.target === 'Other' ? '__other__' : '')}
          onChange={(v) => {
            if (v === '__other__') {
              onChange({ ...value, target: 'Other', targetOther: '' })
            } else {
              const selected = targetOptions.find((o) => String(o.value) === v)?.label || ''
              onChange({ ...value, target: selected, targetOther: undefined })
            }
          }}
          allowEmpty
        />
        {value.target === 'Other' && (
          <input
            type="text"
            value={value.targetOther || ''}
            onChange={(e) => onChange({ ...value, targetOther: e.target.value })}
            placeholder="Specify target language"
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      <SearchableSelect
        label="Intended Use"
        options={uses}
        value={uses.find((o) => o.label === value.purpose)?.value}
        onChange={(v) => {
          const selected = uses.find((o) => String(o.value) === v)?.label || ''
          onChange({ ...value, purpose: selected })
        }}
        allowEmpty
      />

      <SearchableSelect
        label="Country of Issue"
        options={countryOptions}
        value={countryOptions.find((o) => o.label === (value.country || ''))?.value}
        onChange={(v) => {
          const selected = countryOptions.find((o) => String(o.value) === v)?.label || ''
          onChange({ ...value, country: selected })
        }}
        allowEmpty
      />
    </div>
  )
}
