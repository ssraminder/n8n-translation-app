"use client"

export type LanguageState = {
  source: string
  target: string
  purpose: string
}

export function LanguageSelects({ value, onChange }: { value: LanguageState; onChange: (v: LanguageState) => void }) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Source Language</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.source}
          onChange={(e)=>onChange({ ...value, source: e.target.value })}
        >
          <option>Auto-detected: English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
          <option>Italian</option>
          <option>Portuguese</option>
          <option>Chinese</option>
          <option>Arabic</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Target Language</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.target}
          onChange={(e)=>onChange({ ...value, target: e.target.value })}
        >
          <option>Spanish</option>
          <option>English</option>
          <option>French</option>
          <option>German</option>
          <option>Italian</option>
          <option>Portuguese</option>
          <option>Chinese</option>
          <option>Arabic</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Intended Use</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value.purpose}
          onChange={(e)=>onChange({ ...value, purpose: e.target.value })}
        >
          <option>Immigration (IRCC)</option>
          <option>Court/Legal</option>
          <option>University Application</option>
          <option>Business/Corporate</option>
          <option>Personal</option>
          <option>Other</option>
        </select>
      </div>
    </div>
  )
}
