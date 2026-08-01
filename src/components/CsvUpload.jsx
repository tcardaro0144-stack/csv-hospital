import { useRef, useState } from 'react'

/**
 * File picker / drop zone — admit CSV for hospital triage.
 */
export default function CsvUpload({
  onFileChange,
  isLoading = false,
  disabled = false,
  readyFileName = null,
}) {
  const inputRef = useRef(null)
  const dragCounterRef = useRef(0)
  const suppressClickRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  function emitFile(file) {
    if (!file || disabled || isLoading) return
    onFileChange?.(file)
  }

  function handleDragEnter(event) {
    event.preventDefault()
    event.stopPropagation()
    if (disabled || isLoading) return
    dragCounterRef.current += 1
    setIsDragging(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 400)

    const file = event.dataTransfer.files?.[0]
    emitFile(file)
  }

  function handleInputChange(event) {
    const file = event.target.files?.[0]
    emitFile(file)
    event.target.value = ''
  }

  function openFilePicker() {
    if (suppressClickRef.current || disabled || isLoading) return
    inputRef.current?.click()
  }

  return (
    <div className="w-full max-w-xl">
      <div
        role="button"
        tabIndex={disabled || isLoading ? -1 : 0}
        aria-busy={isLoading}
        aria-label="Admit CSV file"
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openFilePicker()
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={[
          'fb-glass flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
          isDragging
            ? 'border-[#00ffc2] bg-[#00ffc2]/10'
            : readyFileName
              ? 'border-[#00ffc2]'
              : 'border-gray-700 hover:border-[#00ffc2]',
          disabled || isLoading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled || isLoading}
        />

        {isLoading ? (
          <>
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#00ffc2] border-t-transparent" />
            <p className="fb-body fb-muted font-medium">
              Running triage…
            </p>
          </>
        ) : readyFileName ? (
          <>
            <p className="fb-body font-medium text-[#00ffc2]">{readyFileName}</p>
            <p className="fb-body fb-muted mt-1">
              Stabilized — drop or browse to re-admit
            </p>
          </>
        ) : (
          <>
            <p className="fb-body font-medium text-[#00ffc2]">
              Drop CSV here or click to admit
            </p>
            <p className="fb-body fb-muted mt-1">
              .csv only · max 5 MB · one-step procedure
            </p>
          </>
        )}
      </div>
    </div>
  )
}
