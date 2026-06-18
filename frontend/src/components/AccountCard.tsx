import { useState } from 'react'
import { RefreshCw, Power, Timer, CheckCircle2, XCircle, Clock, TrendingUp, Trash2 } from 'lucide-react'
import type { AccountStatus } from '../types'
import { apiFetch } from '../api'

function StatusIcon({ account }: { account: AccountStatus }) {
  if (!account.enabled) return <XCircle className="w-4 h-4 text-red-500" />
  if (account.cooldown_secs > 0) return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
  return <CheckCircle2 className="w-4 h-4 text-green-400" />
}

function BalanceColor(balance: number) {
  if (balance >= 10) return 'text-green-400'
  if (balance >= 3) return 'text-yellow-400'
  return 'text-red-400'
}

function Btn({ icon, label, onClick, disabled, variant = 'default' }: {
  icon: React.ReactNode; label: string; onClick: () => void
  disabled: boolean; variant?: 'default' | 'danger' | 'success'
}) {
  const cls = {
    default: 'text-gray-400 hover:text-white hover:bg-gray-700',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
    success: 'text-green-400 hover:text-green-300 hover:bg-green-500/10',
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {icon}{label}
    </button>
  )
}

function IconBtn({ icon, onClick, disabled, variant = 'default', title }: {
  icon: React.ReactNode; onClick: () => void
  disabled: boolean; variant?: 'default' | 'danger' | 'success'; title?: string
}) {
  const cls = {
    default: 'text-gray-400 hover:text-white hover:bg-gray-700',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
    success: 'text-green-400 hover:text-green-300 hover:bg-green-500/10',
  }[variant]
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {icon}
    </button>
  )
}

export function AccountCard({ account, onUpdate, compact = false }: {
  account: AccountStatus; onUpdate: () => Promise<void>; compact?: boolean
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const call = async (path: string, key: string) => {
    setBusy(key)
    try {
      await apiFetch(`/admin/accounts/${account.index}/${path}`, { method: 'POST' })
      await onUpdate()
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setBusy('delete')
    try {
      await apiFetch(`/admin/accounts/${account.index}`, { method: 'DELETE' })
      await onUpdate()
    } finally {
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  const lastChecked = account.last_checked
    ? new Date(account.last_checked).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const borderColor = account.available ? 'border-gray-700'
    : account.enabled ? 'border-yellow-900/50' : 'border-gray-800'

  // ── Compact row ──────────────────────────────────────────────
  if (compact) return (
    <div className={`flex items-center gap-3 px-4 py-1.5 rounded-lg border bg-gray-900 text-sm ${borderColor} ${!account.enabled ? 'opacity-55' : ''}`}>
      <StatusIcon account={account} />
      <span className="font-medium w-24 truncate shrink-0">{account.alias}</span>
      {account.last_checked
        ? <span className={`font-bold tabular-nums w-16 shrink-0 ${BalanceColor(account.balance)}`}>¥{account.balance.toFixed(2)}</span>
        : <span className="font-bold text-gray-400 w-16 shrink-0">—</span>}
      <span className="text-xs text-gray-300 shrink-0">{account.coupon_count}券</span>
      <span className="text-xs text-gray-300 shrink-0">{lastChecked}</span>
      {account.cooldown_secs > 0 && (
        <span className="text-xs text-yellow-500 shrink-0 flex items-center gap-1">
          <Timer className="w-3 h-3" />{account.cooldown_secs}s
        </span>
      )}
      <div className="flex items-center gap-0.5 ml-auto">
        <IconBtn icon={<RefreshCw className={`w-3.5 h-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />}
          onClick={() => call('refresh', 'refresh')} disabled={!!busy} title="查余额" />
        <IconBtn icon={<Power className="w-3.5 h-3.5" />}
          onClick={() => call('toggle', 'toggle')} disabled={!!busy}
          variant={account.enabled ? 'danger' : 'success'} title={account.enabled ? '停用' : '启用'} />
        {account.cooldown_secs > 0 && (
          <IconBtn icon={<Timer className="w-3.5 h-3.5" />}
            onClick={() => call('cooldown/clear', 'clear')} disabled={!!busy} title="解冻" />
        )}
        <IconBtn icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={handleDelete} disabled={!!busy}
          variant={confirmDelete ? 'danger' : 'default'}
          title={confirmDelete ? '再次点击确认删除' : '删除'} />
      </div>
    </div>
  )

  // ── Card view ─────────────────────────────────────────────────
  return (
    <div className={`rounded-xl border bg-gray-900 p-5 flex flex-col gap-4 transition-all ${borderColor} ${!account.enabled ? 'opacity-55' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon account={account} />
          <span className="font-semibold text-sm truncate">{account.alias}</span>
        </div>
        <span className="text-xs text-gray-300 shrink-0 ml-2">#{account.index + 1}</span>
      </div>

      <div>
        {account.last_checked ? (
          <div className={`text-3xl font-bold tabular-nums ${BalanceColor(account.balance)}`}>
            ¥{account.balance.toFixed(2)}
          </div>
        ) : (
          <div className="text-3xl font-bold text-gray-400">—</div>
        )}
        <div className="text-xs text-gray-300 mt-0.5">
          {account.last_checked ? `${account.coupon_count} 张有效券` : '尚未查询'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/60 rounded-lg p-2.5">
          <div className="flex items-center gap-1 text-gray-300 text-xs mb-1">
            <TrendingUp className="w-3 h-3" />请求数
          </div>
          <div className="font-mono text-sm font-medium text-gray-100">{account.request_count.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2.5">
          <div className="text-gray-300 text-xs mb-1">更新于</div>
          <div className="text-sm font-medium text-gray-100">{lastChecked}</div>
        </div>
      </div>

      {account.cooldown_secs > 0 && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
          <Timer className="w-3.5 h-3.5 shrink-0" />限流冷却 {account.cooldown_secs}s
        </div>
      )}

      <div className="flex items-center gap-1 pt-1 border-t border-gray-800 -mx-1">
        <Btn icon={<RefreshCw className={`w-3.5 h-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />}
          label="查余额" onClick={() => call('refresh', 'refresh')} disabled={!!busy} />
        <Btn icon={<Power className="w-3.5 h-3.5" />}
          label={account.enabled ? '停用' : '启用'}
          onClick={() => call('toggle', 'toggle')} disabled={!!busy}
          variant={account.enabled ? 'danger' : 'success'} />
        {account.cooldown_secs > 0 && (
          <Btn icon={<Timer className="w-3.5 h-3.5" />}
            label="解冻" onClick={() => call('cooldown/clear', 'clear')} disabled={!!busy} />
        )}
        <Btn icon={<Trash2 className="w-3.5 h-3.5" />}
          label={confirmDelete ? '确认删除' : '删除'}
          onClick={handleDelete} disabled={!!busy}
          variant={confirmDelete ? 'danger' : 'default'} />
      </div>
    </div>
  )
}
