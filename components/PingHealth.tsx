"use client"
import { useState } from 'react'

export function PingHealth() {
  const [out, setOut] = useState('Click the button to fetch /api/health')
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-3">
      <button className="primary-button" onClick={async () => {
        try {
          setBusy(true); setOut('Loading...')
          const res = await fetch('/api/health')
          const data = await res.json()
          setOut(JSON.stringify(data, null, 2))
        } catch (e: any) {
          setOut('Request failed: ' + (e?.message || String(e)))
        } finally { setBusy(false) }
      }} disabled={busy}>Ping Health</button>
      <pre className="code-surface overflow-auto text-sm">{out}</pre>
    </div>
  )
}
