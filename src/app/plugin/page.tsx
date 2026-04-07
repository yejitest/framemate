'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/Button'
import {
  Puzzle,
  Download,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Terminal,
  MessageSquare,
  Copy,
  Check,
  Zap,
} from 'lucide-react'

const PLUGIN_FILES = [
  { name: 'manifest.json', path: '/framemate-plugin/manifest.json', desc: '플러그인 설정 파일' },
  { name: 'code.js', path: '/framemate-plugin/code.js', desc: '플러그인 실행 코드' },
  { name: 'ui.html', path: '/framemate-plugin/ui.html', desc: '플러그인 UI' },
]

const STEPS = [
  {
    num: '01',
    title: '플러그인 파일 다운로드',
    desc: '아래 3개 파일을 모두 같은 폴더(예: ~/Downloads/framemate-plugin/)에 저장하세요.',
    detail: null,
  },
  {
    num: '02',
    title: 'Figma에서 플러그인 가져오기',
    desc: 'Figma 데스크탑 앱에서 플러그인을 가져옵니다.',
    detail: [
      'Figma 파일을 엽니다',
      '상단 메뉴에서 Plugins 클릭',
      'Development → Import plugin from manifest... 선택',
      '다운로드한 폴더에서 manifest.json 파일 선택',
    ],
  },
  {
    num: '03',
    title: 'Framemate 앱에서 UI 요청',
    desc: 'Agent Chat에서 원하는 UI를 자연어로 요청하세요.',
    detail: null,
  },
  {
    num: '04',
    title: '코드 복사 후 플러그인에서 실행',
    desc: '생성된 코드를 복사해 Framemate 플러그인에 붙여넣고 Run을 클릭하세요.',
    detail: [
      '채팅에서 생성된 코드 블록의 복사 버튼 클릭',
      'Figma에서 Plugins → Framemate 클릭',
      '코드 붙여넣기 (Cmd+V)',
      '▶ Run 버튼 클릭 또는 Cmd+Enter',
    ],
  },
]

export default function PluginPage() {
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  async function handleCopyPath(path: string) {
    const fullUrl = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(fullUrl)
    setCopiedFile(path)
    setTimeout(() => setCopiedFile(null), 2000)
  }

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-3xl" style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={14} strokeWidth={1.5} className="text-muted" />
            <span className="text-xs text-muted uppercase tracking-widest font-medium">
              FIGMA PLUGIN
            </span>
          </div>
          <h1 className="text-2xl font-bold text-fg">
            Framemate 플러그인 설치
          </h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            플러그인을 설치하면 채팅에서 생성된 코드를 Figma 캔버스에 바로 실행할 수 있습니다.
            설치는 단 한 번만 하면 됩니다.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div key={i} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-start gap-4">
                <span className="text-xs font-bold text-muted mt-0.5 shrink-0 w-8 font-mono">
                  {step.num}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-fg mb-1">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted leading-relaxed">
                    {step.desc}
                  </p>

                  {/* Step 1: Download files */}
                  {i === 0 && (
                    <div className="mt-4 space-y-2">
                      {PLUGIN_FILES.map((file) => (
                        <div
                          key={file.name}
                          className="flex items-center justify-between p-3 bg-gray-50 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-2.5">
                            <Terminal size={13} strokeWidth={1.5} className="text-muted" />
                            <div>
                              <span className="text-xs text-fg font-semibold font-mono">
                                {file.name}
                              </span>
                              <span className="text-xs text-muted ml-2">
                                {file.desc}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyPath(file.path)}
                              title="URL 복사"
                              className="flex items-center gap-1 text-xs text-muted hover:text-fg transition-colors cursor-pointer px-2 py-1 rounded"
                            >
                              {copiedFile === file.path ? (
                                <Check size={11} strokeWidth={2} className="text-green-500" />
                              ) : (
                                <Copy size={11} strokeWidth={1.5} />
                              )}
                            </button>
                            <a
                              href={file.path}
                              download={file.name}
                              className="flex items-center gap-1.5 text-xs text-white bg-fg hover:bg-fg/80 px-3 py-1.5 rounded-lg transition-colors font-medium"
                            >
                              <Download size={11} strokeWidth={1.5} />
                              다운로드
                            </a>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted mt-2">
                        💡 3개 파일을 모두 <strong className="text-fg">같은 폴더</strong>에 저장해야 합니다.
                      </p>
                    </div>
                  )}

                  {/* Step 2 & 4: Detail list */}
                  {step.detail && (
                    <div className="mt-3 space-y-1.5">
                      {step.detail.map((item, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <ChevronRight size={12} strokeWidth={2} className="text-muted mt-0.5 shrink-0" />
                          <span className="text-xs text-fg/70 leading-relaxed">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Chat link */}
                  {i === 2 && (
                    <div className="mt-3">
                      <Link href="/chat">
                        <Button variant="secondary" className="text-xs h-8 gap-1.5">
                          <MessageSquare size={12} strokeWidth={1.5} />
                          Agent Chat 열기
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
                <div className="mt-0.5">
                  <CheckCircle2 size={15} strokeWidth={1.5} className="text-border" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Plugin preview */}
        <div className="mt-8 bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest">
              플러그인 미리보기
            </p>
          </div>
          <div className="p-5">
            <div
              className="mx-auto max-w-xs bg-white rounded-xl border border-border p-4 shadow-sm"
            >
              {/* Plugin header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-fg flex items-center justify-center">
                  <Zap size={11} className="text-white" />
                </div>
                <span className="text-sm font-bold text-fg">Framemate</span>
                <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-border font-medium">
                  Plugin
                </span>
              </div>

              {/* Steps mini */}
              <div className="space-y-2 mb-4">
                {['웹앱에서 UI 요청', '복사 버튼으로 코드 복사', '붙여넣기 후 Run 클릭'].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted">
                    <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold flex items-center justify-center shrink-0 border border-border">
                      {i + 1}
                    </span>
                    {s}
                  </div>
                ))}
              </div>

              {/* Code area */}
              <div className="h-16 bg-gray-50 rounded-lg border border-border flex items-center justify-center mb-3">
                <span className="text-xs text-muted">코드를 여기에 붙여넣으세요</span>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-fg rounded-lg flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">▶ Run</span>
                </div>
                <div className="w-16 h-8 bg-white rounded-lg border border-border flex items-center justify-center">
                  <span className="text-xs text-muted">Clear</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help note */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-gray-50 border border-border rounded-xl">
          <ExternalLink size={14} strokeWidth={1.5} className="text-muted shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-fg/80 leading-relaxed">
              Figma 데스크탑 앱 설치가 필요합니다. 브라우저 버전의 Figma에서는 플러그인 개발 기능이 제한될 수 있습니다.
            </p>
            <a
              href="https://www.figma.com/downloads/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-fg font-medium hover:underline mt-1"
            >
              figma.com/downloads
              <ExternalLink size={10} strokeWidth={1.5} />
            </a>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
