'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { type FigmaSettings } from '@/types'
import {
  Settings,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'
type VarLoadStatus = 'idle' | 'loading' | 'success' | 'error'

interface ColorToken {
  id: string
  name: string
  collection: string
  hex: string
  r: number; g: number; b: number; a: number
}

interface NumberToken {
  id: string
  name: string
  collection: string
  value: number
  role: 'radius' | 'spacing' | 'size' | 'opacity' | 'other'
}

interface VariablesResult {
  colors: ColorToken[]
  numbers: NumberToken[]
  totalCount: number
  collectionNames: string[]
}

function extractFileKey(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed.includes('/')) return trimmed
  const match = trimmed.match(/figma\.com\/(?:design|file|proto)\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<FigmaSettings>({
    personalAccessToken: '',
    dsFileUrl: '',
  })
  const [showToken, setShowToken] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saved, setSaved] = useState(false)

  const [varStatus, setVarStatus] = useState<VarLoadStatus>('idle')
  const [varError, setVarError] = useState('')
  const [variables, setVariables] = useState<VariablesResult | null>(null)
  const [activeCollection, setActiveCollection] = useState<string>('all')

  useEffect(() => {
    const stored = localStorage.getItem('framemate:settings')
    if (stored) {
      try {
        setSettings(JSON.parse(stored))
      } catch {
        /* ignore */
      }
    }
  }, [])

  function handleSave() {
    localStorage.setItem('framemate:settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    if (!settings.personalAccessToken) {
      setTestStatus('error')
      setTestMessage('Personal Access Token을 먼저 입력해주세요')
      return
    }

    setTestStatus('testing')
    setTestMessage('')

    try {
      const res = await fetch('/api/figma/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.personalAccessToken }),
      })
      const data = await res.json() as { ok: boolean; name?: string; error?: string }
      if (data.ok) {
        setTestStatus('success')
        setTestMessage(data.name ? `연결 성공: ${data.name}` : '연결 성공')
      } else {
        setTestStatus('error')
        setTestMessage(data.error ?? '연결 실패')
      }
    } catch {
      setTestStatus('error')
      setTestMessage('네트워크 오류가 발생했습니다')
    }
  }

  async function handleLoadVariables() {
    if (!settings.personalAccessToken || !settings.dsFileUrl) {
      setVarError('PAT와 파일 URL을 먼저 입력하고 저장해주세요')
      setVarStatus('error')
      return
    }
    const fileKey = extractFileKey(settings.dsFileUrl)
    if (!fileKey) {
      setVarError('유효한 Figma 파일 URL을 입력해주세요')
      setVarStatus('error')
      return
    }

    setVarStatus('loading')
    setVarError('')
    setVariables(null)
    setActiveCollection('all')

    try {
      const res = await fetch('/api/figma/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.personalAccessToken, fileKey }),
      })
      const data = await res.json() as VariablesResult & { error?: string }
      if (!res.ok || data.error) {
        setVarError(data.error ?? '불러오기 실패')
        setVarStatus('error')
        return
      }
      setVariables(data)
      setVarStatus('success')
    } catch {
      setVarError('네트워크 오류가 발생했습니다')
      setVarStatus('error')
    }
  }

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={14} strokeWidth={1.5} className="text-muted" />
            <span className="text-xs text-muted uppercase tracking-widest font-medium">
              SETTINGS
            </span>
          </div>
          <h1
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}
          >
            Figma 연결 설정
          </h1>
          <p className="text-sm text-muted mt-1" style={{ fontFamily: 'Pretendard, sans-serif' }}>
            Figma MCP 에이전트가 사용할 인증 정보를 입력합니다. 정보는 브라우저에만 저장됩니다.
          </p>
        </div>

        <div className="space-y-6">
          {/* PAT Field */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <label
              className="block text-sm font-medium text-fg mb-1"
              style={{ fontFamily: 'Pretendard, sans-serif' }}
            >
              Personal Access Token
            </label>
            <p className="text-xs text-muted mb-3" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              Figma → Settings → Security → Personal access tokens에서 발급
            </p>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.personalAccessToken}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, personalAccessToken: e.target.value }))
                }
                placeholder="figd_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-bg border border-border rounded-lg h-9 px-3 pr-10 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors"
              >
                {showToken ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="secondary"
                onClick={handleTest}
                loading={testStatus === 'testing'}
                className="text-xs h-8 px-3"
              >
                연결 테스트
              </Button>
              {testStatus === 'success' && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} strokeWidth={1.5} className="text-green-500" />
                  <span className="text-xs text-green-600">
                    {testMessage}
                  </span>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-center gap-1.5">
                  <XCircle size={13} strokeWidth={1.5} className="text-red-400" />
                  <span className="text-xs text-red-500">
                    {testMessage}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DS File URL */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <label
              className="block text-sm font-medium text-fg mb-1"
              style={{ fontFamily: 'Pretendard, sans-serif' }}
            >
              Design System File URL
            </label>
            <p className="text-xs text-muted mb-3" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              에이전트가 읽고 프레임을 생성할 Figma 파일 URL (디자인 시스템 또는 작업 파일)
            </p>
            <input
              type="url"
              value={settings.dsFileUrl}
              onChange={(e) => {
                setSettings((s) => ({ ...s, dsFileUrl: e.target.value }))
                setVariables(null)
                setVarStatus('idle')
              }}
              placeholder="https://www.figma.com/design/..."
              className="w-full bg-bg border border-border rounded-lg h-9 px-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 transition-all font-mono text-[12px]"
            />

            {/* Load Variables button */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="secondary"
                onClick={handleLoadVariables}
                loading={varStatus === 'loading'}
                className="text-xs h-8 px-3 gap-1.5"
              >
                <RefreshCw size={12} strokeWidth={1.5} />
                Variables 불러오기
              </Button>
              {varStatus === 'success' && variables && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} strokeWidth={1.5} />
                  총 {variables.totalCount}개 ({variables.colors.length}색상 · {variables.numbers.length}숫자)
                </span>
              )}
              {varStatus === 'error' && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle size={12} strokeWidth={1.5} />
                  {varError}
                </span>
              )}
            </div>
          </div>

          {/* Variables Preview */}
          {varStatus === 'success' && variables && variables.totalCount > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted uppercase tracking-widest font-medium">
                  Variables 미리보기
                </p>
                <Badge variant="agent">{variables.totalCount}개</Badge>
              </div>

              {/* Collection filter */}
              {variables.collectionNames.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setActiveCollection('all')}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeCollection === 'all'
                        ? 'bg-fg text-white border-fg'
                        : 'border-border text-muted hover:border-gray-400 hover:text-fg'
                    }`}
                  >
                    All
                  </button>
                  {variables.collectionNames.map((col) => (
                    <button
                      key={col}
                      onClick={() => setActiveCollection(col)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        activeCollection === col
                          ? 'bg-fg text-white border-fg'
                          : 'border-border text-muted hover:border-gray-400 hover:text-fg'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              )}

              {/* Color tokens */}
              {variables.colors.filter((c) => activeCollection === 'all' || c.collection === activeCollection).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted mb-2 font-mono">
                    COLOR · {variables.colors.filter((c) => activeCollection === 'all' || c.collection === activeCollection).length}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {variables.colors
                      .filter((c) => activeCollection === 'all' || c.collection === activeCollection)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2.5 bg-bg rounded-lg px-2.5 py-2 min-w-0"
                        >
                          <div
                            className="w-5 h-5 rounded flex-shrink-0 border border-white/10"
                            style={{
                              backgroundColor: c.hex,
                              opacity: c.a,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-fg truncate font-mono" title={c.name}>
                              {c.name}
                            </p>
                            <p className="text-[10px] text-muted font-mono">
                              {c.hex.toUpperCase()}{c.a < 1 ? ` / ${Math.round(c.a * 100)}%` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Number tokens */}
              {variables.numbers.filter((n) => activeCollection === 'all' || n.collection === activeCollection).length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-2 font-mono">
                    NUMBER · {variables.numbers.filter((n) => activeCollection === 'all' || n.collection === activeCollection).length}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {variables.numbers
                      .filter((n) => activeCollection === 'all' || n.collection === activeCollection)
                      .map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between bg-bg rounded-lg px-2.5 py-2"
                        >
                          <p
                            className="text-[11px] text-fg truncate flex-1 min-w-0 mr-2 font-mono"
                            title={n.name}
                          >
                            {n.name}
                          </p>
                          <span
                            className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded font-mono font-medium ${
                              n.role === 'radius'
                                ? 'bg-blue-50 text-blue-500 border border-blue-100'
                                : n.role === 'spacing'
                                ? 'bg-green-50 text-green-600 border border-green-100'
                                : n.role === 'size'
                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                : 'text-muted bg-gray-100 border border-border'
                            }`}
                          >
                            {n.value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MCP Note */}
          <div className="bg-gray-50 border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Badge variant="muted">MCP</Badge>
              <div>
                <p className="text-xs text-fg/80 leading-relaxed">
                  Figma write 기능은 Figma MCP Remote Server 연결이 필요합니다.
                </p>
                <a
                  href="https://mcp.figma.com/sse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-fg font-medium hover:underline mt-1"
                >
                  mcp.figma.com/sse
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>
              {saved ? '저장 완료 ✓' : '설정 저장'}
            </Button>
            {saved && (
              <span className="text-xs text-green-600">
                로컬 스토리지에 저장되었습니다
              </span>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
