import { Copy, Check, Zap, Plus, FlaskConical, Trash2, LayoutGrid, List, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { AccountStatus } from '../types'
import { AddAccountModal } from './AddAccountModal'
import { TestModal } from './TestModal'
import { apiFetch, clearToken } from '../api'

export function TopBar({ accounts, onUpdate, compact, onToggleCompact }: {
  accounts: AccountStatus[]
  onUpdate: () => Promise<void>
  compact: boolean
  onToggleCompact: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [apiFormat, setApiFormat] = useState<'openai' | 'anthropic'>('openai')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    apiFetch('/admin/config')
      .then(r => r.json())
      .then(data => setBaseUrl(data.public_url))
      .catch(() => setBaseUrl(''))
  }, [])

  const endpoint = apiFormat === 'openai' ? `${baseUrl}/v1` : baseUrl
  const apiLabel = apiFormat === 'openai' ? 'OpenAI' : 'Anthropic'
  const active = accounts.filter(a => a.available).length

  const copy = async () => {
    await navigator.clipboard.writeText(endpoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleApiFormat = () => {
    setApiFormat(prev => prev === 'openai' ? 'anthropic' : 'openai')
  }

  const clearAll = async () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return }
    await apiFetch('/admin/accounts', { method: 'DELETE' })
    setClearConfirm(false)
    await onUpdate()
  }

  const logout = () => {
    clearToken()
    window.dispatchEvent(new Event('bb:unauthorized'))
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-lg tracking-tight">BudgetBridge</span>
            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
              {active}/{accounts.length} 可用
            </span>
          </div>

          <div className="flex items-center gap-2 max-w-md w-full">
            <button
              onClick={toggleApiFormat}
              className="shrink-0 px-2 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 hover:text-white transition-colors"
              title={`切换为 ${apiFormat === 'openai' ? 'Anthropic' : 'OpenAI'} 格式`}
            >
              {apiLabel}
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 transition-colors group flex-1"
            >
              <span className="text-xs font-mono text-gray-300 truncate flex-1 text-left">{endpoint}</span>
              {copied
                ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                : <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-200 shrink-0 transition-colors" />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleCompact}
              title={compact ? '卡片视图' : '紧凑视图'}
              className="flex items-center justify-center w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
            >
              {compact ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowTest(true)}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors"
            >
              <FlaskConical className="w-4 h-4" />
              测试
            </button>
            <button
              onClick={clearAll}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                clearConfirm
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {clearConfirm ? '确认清空？' : '清空'}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加账号
            </button>
            <button
              onClick={logout}
              title="退出登录"
              className="flex items-center justify-center w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onAdded={onUpdate} />}
      {showTest && <TestModal onClose={() => setShowTest(false)} />}
    </>
  )
}

