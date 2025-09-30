"use client"
import { useEffect, useRef, useState } from 'react'

export function ReferenceModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (payload: { notes: string; files: File[] }) => Promise<void> }) {
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{ if (!open) { setNotes(''); setFiles([]) } }, [open])

  async function handleSubmit(){
    setLoading(true)
    try { await onSubmit({ notes, files }); onClose() } finally { setLoading(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 md:p-8 max-w-lg w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Add Reference Files or Notes</h3>
        <textarea
          value={notes}
          onChange={(e)=>setNotes(e.target.value)}
          rows={4}
          placeholder="Enter any instructions or reference links here"
          className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mb-4">
          <button type="button" onClick={()=>inputRef.current?.click()} className="px-3 py-2 border rounded-md">Select files</button>
          <input ref={inputRef} type="file" className="hidden" multiple onChange={(e)=>{
            const list = e.target.files ? Array.from(e.target.files) : []
            setFiles(list)
          }} />
        </div>
        {files.length>0 && (
          <ul className="text-sm text-gray-700 mb-4 list-disc pl-5">
            {files.map((f,i)=> <li key={i}>{f.name}</li>)}
          </ul>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 text-white">{loading? 'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  )
}
