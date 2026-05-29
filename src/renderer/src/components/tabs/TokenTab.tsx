import React from 'react'
import { useAppStore } from '../../store'
import { MODEL_DEFINITIONS } from '../../../../shared/models'

export function TokenTab(): React.ReactElement {
  const { sessionUsage, usageHistory, settings } = useAppStore()

  const modelDef = MODEL_DEFINITIONS.find((m) => m.id === (settings?.model ?? 'gemini-2.5-flash'))
  const costUsd = sessionUsage && modelDef
    ? (sessionUsage.promptTokens / 1_000_000) * modelDef.inputPricePerMToken
      + (sessionUsage.completionTokens / 1_000_000) * modelDef.outputPricePerMToken
    : 0

  function fmt(n: number): string {
    return n.toLocaleString('ja-JP')
  }
  function fmtCost(n: number): string {
    return `$${n.toFixed(6)}`
  }
  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'medium' })
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full scrollbar-thin">
      {/* Session summary */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-subtext mb-3 uppercase tracking-wide">
          今セッション
        </h2>
        {sessionUsage ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['入力トークン', fmt(sessionUsage.promptTokens)],
              ['出力トークン', fmt(sessionUsage.completionTokens)],
              ['合計トークン', fmt(sessionUsage.totalTokens)],
              ['概算コスト', fmtCost(costUsd)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-overlay px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-dark-muted">{label}</p>
                <p className="text-xl font-mono font-semibold text-gray-900 dark:text-dark-text mt-1">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-dark-muted">まだ翻訳を実行していません</p>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-subtext mb-3 uppercase tracking-wide">
          履歴
        </h2>
        {usageHistory.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-dark-muted">履歴がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-dark-muted border-b border-gray-200 dark:border-dark-overlay">
                  <th className="pb-2 pr-4">日時</th>
                  <th className="pb-2 pr-4">モデル</th>
                  <th className="pb-2 pr-4 text-right">入力</th>
                  <th className="pb-2 pr-4 text-right">出力</th>
                  <th className="pb-2 text-right">コスト</th>
                </tr>
              </thead>
              <tbody>
                {[...usageHistory].reverse().map((rec) => (
                  <tr key={rec.id} className="border-b border-gray-100 dark:border-dark-overlay hover:bg-gray-50 dark:hover:bg-dark-surface">
                    <td className="py-2 pr-4 text-gray-600 dark:text-dark-subtext whitespace-nowrap">
                      {fmtDate(rec.timestamp)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-dark-subtext">{rec.model}</td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-800 dark:text-dark-text">{fmt(rec.promptTokens)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-800 dark:text-dark-text">{fmt(rec.completionTokens)}</td>
                    <td className="py-2 text-right font-mono text-gray-800 dark:text-dark-text">{fmtCost(rec.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
