import { useEffect, useState, useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { AccountCard } from './components/AccountCard'
import { LoginPage } from './components/LoginPage'
import { apiFetch, clearToken } from './api'
import type { AccountStatus } from './types'

export default function App() {
  const [accounts, setAccounts] = useState<AccountStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [compact, setCompact] = useState(false)
  const [authed, setAuthed] = useState(true)

  // Any 401 from apiFetch fires this event → show login
  useEffect(() => {
    const handler = () => setAuthed(false)
    window.addEventListener('bb:unauthorized', handler)
    return () => window.removeEventListener('bb:unauthorized', handler)
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/accounts')
      if (res.status === 401) { clearToken(); setAuthed(false); return }
      setAccounts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
    const t = setInterval(fetchAccounts, 10_000)
    return () => clearInterval(t)
  }, [fetchAccounts])

  if (!authed) return <LoginPage onLogin={() => { setAuthed(true); fetchAccounts() }} />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopBar accounts={accounts} onUpdate={fetchAccounts} compact={compact} onToggleCompact={() => setCompact(v => !v)} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">加载中…</div>
        ) : accounts.length === 0 ? (
          <div className="flex items-center justify-center py-32 text-gray-400">暂无账号</div>
        ) : compact ? (
          <div className="flex flex-col gap-1">
            {accounts.map(acc => (
              <AccountCard key={acc.index} account={acc} onUpdate={fetchAccounts} compact />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accounts.map(acc => (
              <AccountCard key={acc.index} account={acc} onUpdate={fetchAccounts} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
