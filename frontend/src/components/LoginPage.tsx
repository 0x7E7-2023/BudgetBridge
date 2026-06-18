import { useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { setToken } from '../api'

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '登录失败'); return }
      setToken(data.token)
      onLogin()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl p-8 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-lg tracking-tight">BudgetBridge</span>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">管理员密码</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full bg-gray-800 border border-gray-700 focus:border-gray-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />登录中…</> : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
