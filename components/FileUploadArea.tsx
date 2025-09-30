"use client"
import { useCallback, useRef } from 'react'
import { Icon } from './Icon'

export function FileUploadArea({ onFilesSelected, accept }: { onFilesSelected: (files: File[]) => void, accept: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) onFilesSelected(files)
  }, [onFilesSelected])

  return (
    <div
      id="uploadArea"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e)=>{ e.preventDefault() }}
      onDrop={onDrop}
      className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
    >
      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Icon name="upload" className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Drop your files here or click to browse</h3>
      <p className="text-gray-600 mb-4">Accepted formats: PDF, JPG, PNG, Word, Excel</p>
      <p className="text-sm text-gray-500">Maximum file size: 50MB per file; up to 50MB total</p>
      <input ref={inputRef} type="file" className="hidden" multiple accept={accept} onChange={(e)=>{
        const list = e.target.files ? Array.from(e.target.files) : []
        if (list.length) onFilesSelected(list)
      }} />
    </div>
  )
}
