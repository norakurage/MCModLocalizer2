import React from 'react'
import { ModProgress } from '../../types'

interface ProgressBarProps {
  item: ModProgress
}

export function ProgressBar({ item }: ProgressBarProps): React.ReactElement {
  const pct = Math.round(item.ratio * 100)
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-xs font-mono text-gray-600 dark:text-dark-subtext truncate w-40 shrink-0">
        {item.modId}
      </span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-dark-overlay rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 dark:bg-dark-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-dark-muted w-12 text-right shrink-0">
        {item.label}
      </span>
    </div>
  )
}
