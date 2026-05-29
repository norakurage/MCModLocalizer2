import React, { useRef } from 'react'
import { IPC } from '../../../../shared/channels'

interface FolderInputProps {
  label: string
  value: string
  hint?: string
  onChange: (path: string) => void
  onJarDrop?: (paths: string[]) => void
}

export function FolderInput({ label, value, hint, onChange, onJarDrop }: FolderInputProps): React.ReactElement {
  const divRef = useRef<HTMLDivElement>(null)

  async function openDialog(): Promise<void> {
    const path = await window.electron.invoke(IPC.DIALOG_OPEN_FOLDER) as string | null
    if (path) onChange(path)
  }

  function onDragOver(e: React.DragEvent): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    divRef.current?.classList.add('ring-2', 'ring-blue-400')
  }

  function onDragLeave(): void {
    divRef.current?.classList.remove('ring-2', 'ring-blue-400')
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault()
    divRef.current?.classList.remove('ring-2', 'ring-blue-400')
    const items = Array.from(e.dataTransfer.files)
    type FileWithPath = File & { path: string }
    const jars = items.filter((f) => f.name.endsWith('.jar')).map((f) => (f as FileWithPath).path)
    const dirs = items.filter((f) => !(f as FileWithPath).path?.endsWith('.jar')).map((f) => (f as FileWithPath).path).filter(Boolean)

    if (jars.length > 0 && onJarDrop) {
      onJarDrop(jars)
    } else if (dirs.length > 0) {
      onChange(dirs[0])
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-dark-subtext">{label}</label>
      <div
        ref={divRef}
        className="flex gap-2 rounded-md border border-gray-300 dark:border-dark-overlay bg-white dark:bg-dark-surface transition-colors"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="フォルダをドロップするか選択..."
          className="flex-1 min-w-0 px-3 py-2 bg-transparent text-sm text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted outline-none rounded-l-md"
        />
        <button
          onClick={openDialog}
          className="px-3 py-2 text-sm bg-gray-100 dark:bg-dark-overlay hover:bg-gray-200 dark:hover:bg-dark-muted text-gray-700 dark:text-dark-subtext rounded-r-md border-l border-gray-300 dark:border-dark-overlay transition-colors whitespace-nowrap"
        >
          選択
        </button>
      </div>
      {hint && (
        <p className="text-xs text-gray-500 dark:text-dark-muted">{hint}</p>
      )}
    </div>
  )
}
