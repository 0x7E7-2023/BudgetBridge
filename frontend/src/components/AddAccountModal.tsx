import { X } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '../api'

const FIELDS = [
  { key: 'alias',     label: '账号别名（选填，留空自动顺延）', placeholder: '账号1', type: 'text',     required: false },
  { key: 'api_key',   label: 'API Key',                        placeholder: 'sk-...', type: 'password', required: true  },
  { key: 'ak_id',     label: 'AccessKey ID',                   placeholder: 'LTAI5...', type: 'text',   required: true  },
  { key: 'ak_secret', label: 'AccessKey Secret',               placeholder: '••••••••', type: 'password', required: true },
] as const

type FormKey = typeof FIELDS[number]['key']

export function AddAccountModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => Promise<void> }) {
  const [form, setForm] = useState<Record<FormKey, string>>(
    { alias: '', api_key: '', ak_id: '', ak_secret: '' }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setError(((await res.json()) as { error: string }).error ?? '添加失败')
        return
      }
      await onAdded()
      onClose()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-base">添加账号</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {FIELDS.map(({ key, label, placeholder, type, required }) => (
            <div key={key}>
              <label className="block text-xs text-gray-300 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 focus:border-gray-500 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? '添加中…' : '添加账号'}
          </button>
        </form>
      </div>
    </div>
  )
}
