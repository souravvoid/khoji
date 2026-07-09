import { useState, useRef, type DragEvent } from 'react'
import { Upload, FileText, Image, FileSpreadsheet, Book } from 'lucide-react'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
}

const SUPPORTED = [
  { icon: FileText, label: 'PDF' },
  { icon: Image, label: 'Image' },
  { icon: FileSpreadsheet, label: 'PPT' },
  { icon: FileText, label: 'DOCX' },
  { icon: Book, label: 'EPUB' },
]

export function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFilesSelected(files)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) onFilesSelected(files)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      aria-label="Upload document"
      className={`border-2 border-dashed rounded-none p-12 text-center cursor-pointer transition-all duration-normal
        ${isDragging
          ? 'border-text-primary bg-bg-secondary scale-[1.01]'
          : 'border-border-default hover:border-border-hover hover:bg-surface-hover'
        }`}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.ppt,.pptx,.doc,.docx,.epub" multiple />
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-none border border-border-default ${isDragging ? 'bg-text-primary text-text-inverse' : 'bg-bg-tertiary text-text-tertiary'}`}>
          <Upload size={32} />
        </div>
        <div>
          <p className="text-base font-medium text-text-primary">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-text-tertiary mt-1">
            Upload PDFs, images, presentations, documents, and ebooks
          </p>
        </div>
        <div className="flex items-center gap-4 mt-2">
          {SUPPORTED.map((fmt, i) => (
            <div key={i} className="flex flex-col items-center gap-1 text-text-tertiary">
              <fmt.icon size={20} />
              <span className="text-xs">{fmt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
