"use client"
import { useLucide } from './useLucide'

export function UploadedFilesList({ files, onRemove }: { files: File[]; onRemove: (idx: number) => void }) {
  useLucide([files.length])
  if (!files.length) return null
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
      <div className="space-y-3">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <i data-lucide="file-text" className="w-5 h-5 text-gray-500 mr-3"></i>
              <div>
                <div className="font-medium text-gray-900">{file.name}</div>
                <div className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
            <button onClick={()=>onRemove(idx)} className="text-red-500 hover:text-red-700">
              <i data-lucide="x" className="w-5 h-5"></i>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
