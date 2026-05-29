import React, { useEffect, useRef, useState } from 'react'
import { LogEntry } from '../../types'

interface LogViewerProps {
  logs: LogEntry[]
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  info: 'text-gray-300 dark:text-dark-subtext',
  warn: 'text-yellow-400 dark:text-dark-yellow',
  error: 'text-red-400 dark:text-dark-red',
}

export function LogViewer({ logs }: LogViewerProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  function onScroll(): void {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  function copyToClipboard(): void {
    const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-900 dark:bg-dark-surface rounded-t border-b border-gray-700 dark:border-dark-overlay">
        <span className="text-xs font-mono text-gray-400 dark:text-dark-muted">ログ</span>
        <button
          onClick={copyToClipboard}
          className="text-xs px-2 py-0.5 rounded bg-gray-700 dark:bg-dark-overlay hover:bg-gray-600 dark:hover:bg-dark-muted text-gray-300 dark:text-dark-subtext transition-colors"
        >
          コピー
        </button>
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto scrollbar-thin bg-gray-900 dark:bg-dark-surface rounded-b px-3 py-2 font-mono text-xs leading-5 space-y-0.5"
      >
        {logs.map((entry) => (
          <div key={entry.id} className={`${LEVEL_STYLE[entry.level]} whitespace-pre-wrap break-all`}>
            <span className="text-gray-500 dark:text-dark-muted mr-2">{entry.timestamp}</span>
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
