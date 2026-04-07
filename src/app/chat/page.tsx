'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { type FigmaSettings, type Message, type Task, type TaskMode } from '@/types'
import {
  ArrowUp,
  Component,
  Monitor,
  Zap,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Puzzle,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

// ─────────────────────────────────────────────────────────────────────────────
// Code block renderer
// ─────────────────────────────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 rounded-xl border border-border overflow-hidden text-xs">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-border">
        <span className="text-muted" style={{ fontFamily: 'monospace' }}>
          {language || 'code'}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/plugin"
            className="flex items-center gap-1 text-muted hover:text-fg transition-colors"
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          >
            <Puzzle size={10} strokeWidth={1.5} />
            <span>플러그인으로 실행하기</span>
          </Link>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-muted hover:text-fg transition-colors cursor-pointer"
          >
            {copied ? (
              <><Check size={11} strokeWidth={2} className="text-[#4ADE80]" /><span className="text-[#4ADE80]">복사됨</span></>
            ) : (
              <><Copy size={11} strokeWidth={1.5} /><span>복사</span></>
            )}
          </button>
        </div>
      </div>
      <pre
        className="p-3 overflow-x-auto text-[11px] leading-relaxed text-fg/90 bg-gray-50"
        style={{ fontFamily: 'monospace', maxHeight: '300px' }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Message content — splits text into plain segments and code blocks
// ─────────────────────────────────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const firstNewline = part.indexOf('\n')
          const language = firstNewline > 3 ? part.slice(3, firstNewline).trim() : ''
          const code = firstNewline > -1 ? part.slice(firstNewline + 1, -3) : part.slice(3, -3)
          return <CodeBlock key={i} code={code} language={language} />
        }
        // Render **bold** markers simply (strip them but preserve surrounding text)
        const rendered = part.replace(/\*\*(.+?)\*\*/g, '$1')
        return (
          <span key={i} className="whitespace-pre-wrap">
            {rendered}
          </span>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main chat component
// ─────────────────────────────────────────────────────────────────────────────

function ChatContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialMode = (searchParams.get('mode') as TaskMode) ?? 'component'

  const [mode, setMode] = useState<TaskMode>(initialMode)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content:
        '안녕하세요! Figma 캔버스에 직접 그려드리는 Framemate입니다.\n어떤 UI를 만들어드릴까요? 자연어로 자유롭게 설명해주세요.\n\n💡 생성된 코드는 **Figma 플러그인**으로 실행하면 바로 캔버스에 그려집니다. 플러그인 설치는 Plugin 메뉴에서 할 수 있어요.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [figmaLink, setFigmaLink] = useState<string | null>(null)
  const [settings, setSettings] = useState<FigmaSettings | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('framemate:settings')
      if (stored) setSettings(JSON.parse(stored) as FigmaSettings)
    } catch {
      /* ignore */
    }
  }, [])

  const saveTask = useCallback(
    (taskId: string, prompt: string, status: Task['status'], link?: string) => {
      try {
        const stored = localStorage.getItem('framemate:tasks')
        const tasks: Task[] = stored ? (JSON.parse(stored) as Task[]) : []
        const newTask: Task = {
          id: taskId,
          mode,
          prompt,
          status,
          figmaLink: link,
          createdAt: new Date(),
          summary: `${mode === 'component' ? '컴포넌트' : '스크린'} 생성 완료`,
        }
        tasks.unshift(newTask)
        localStorage.setItem('framemate:tasks', JSON.stringify(tasks.slice(0, 50)))
      } catch {
        /* ignore */
      }
    },
    [mode],
  )

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    const prompt = input.trim()
    setInput('')
    setIsStreaming(true)
    setFigmaLink(null)

    const agentMsgId = uuidv4()
    setMessages((prev) => [
      ...prev,
      { id: agentMsgId, role: 'agent', content: '', timestamp: new Date() },
    ])

    // Extract file key from dsFileUrl
    const fileKey = settings?.dsFileUrl?.trim() ?? ''

    try {
      const res = await fetch('/api/figma/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode,
          token: settings?.personalAccessToken || undefined,
          fileKey: fileKey || undefined,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Agent API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let taskId: string | null = null
      let receivedFigmaLink: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6)
            if (raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw) as {
                text?: string
                taskId?: string
                figmaLink?: string
              }
              if (parsed.text) {
                accumulated += parsed.text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId ? { ...m, content: accumulated } : m,
                  ),
                )
              }
              if (parsed.taskId) taskId = parsed.taskId
              if (parsed.figmaLink) receivedFigmaLink = parsed.figmaLink
            } catch {
              accumulated += raw
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: accumulated } : m,
                ),
              )
            }
          }
        }
      }

      if (taskId) {
        setCurrentTaskId(taskId)
        saveTask(taskId, prompt, 'success', receivedFigmaLink ?? undefined)
      }
      if (receivedFigmaLink) setFigmaLink(receivedFigmaLink)
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content:
                  '죄송합니다, 요청을 처리하는 중 오류가 발생했습니다.\nSettings에서 Figma PAT가 올바르게 설정되어 있는지 확인해주세요.',
              }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasSettings =
    settings?.personalAccessToken && settings?.dsFileUrl

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-sm font-bold text-fg"
              style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}

            >
              Agent Chat
            </h1>
            <div className="flex items-center gap-1 bg-gray-100 border border-border rounded-lg p-0.5">
              <button
                onClick={() => setMode('component')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all duration-[120ms] cursor-pointer ${
                  mode === 'component'
                    ? 'bg-fg text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                <Component size={12} strokeWidth={1.5} />
                컴포넌트 생성
              </button>
              <button
                onClick={() => setMode('screen')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all duration-[120ms] cursor-pointer ${
                  mode === 'screen'
                    ? 'bg-fg text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                <Monitor size={12} strokeWidth={1.5} />
                스크린 스캐폴딩
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Figma link button */}
            {figmaLink && (
              <a
                href={figmaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-fg hover:opacity-70 border border-border bg-white px-3 py-1.5 rounded-lg transition-opacity shadow-sm"
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                <ExternalLink size={12} strokeWidth={1.5} />
                Figma에서 열기
              </a>
            )}
            {currentTaskId && (
              <Button
                variant="secondary"
                onClick={() => router.push(`/result/${currentTaskId}`)}
                className="text-xs h-8 px-3"
              >
                결과 보기
              </Button>
            )}
          </div>
        </div>

        {/* Settings warning */}
        {!hasSettings && (
          <div className="px-6 py-2.5 bg-gray-50 border-b border-border flex items-center justify-between">
            <p
              className="text-xs text-muted"
              style={{ fontFamily: 'Pretendard, sans-serif' }}
            >
              Figma PAT와 파일 URL을 설정하면 파일 연동 및 자동 코멘트 기능이 활성화됩니다.
            </p>
            <Link href="/settings">
              <button className="flex items-center gap-1 text-xs text-fg font-semibold hover:opacity-70 transition-opacity cursor-pointer">
                <Settings size={11} strokeWidth={1.5} />
                설정하기
              </button>
            </Link>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'agent' && (
                <div className="w-6 h-6 rounded-lg btn-gradient flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
                  <Zap size={11} strokeWidth={1.5} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[72%] px-4 py-3 text-sm leading-relaxed rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-fg text-white'
                    : 'bg-white text-fg border border-border'
                }`}
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                <MessageContent content={msg.content} />
                {msg.role === 'agent' &&
                  isStreaming &&
                  msg.id === messages[messages.length - 1]?.id && (
                    <span className="inline-block w-0.5 h-3.5 bg-muted ml-0.5 animate-pulse align-middle" />
                  )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border">
          <div className="bg-white border border-border rounded-2xl focus-within:border-fg focus-within:ring-2 focus-within:ring-black/8 transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'component'
                  ? 'Primary 버튼 컴포넌트를 보라색으로 만들어줘...'
                  : '대시보드 메인 화면 레이아웃을 만들어줘...'
              }
              rows={1}
              className="w-full bg-transparent text-sm text-fg placeholder:text-muted resize-none focus:outline-none px-4 pt-4 pb-2"
              style={{ fontFamily: 'Pretendard, sans-serif', maxHeight: '200px' }}
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={mode === 'component' ? 'agent' : 'screen'}>
                  {mode === 'component' ? '컴포넌트' : '스크린'}
                </Badge>
                {hasSettings ? (
                  <Badge variant="success">Figma 연결됨</Badge>
                ) : (
                  <Badge variant="muted">Figma 미연결</Badge>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-full bg-fg text-white flex items-center justify-center disabled:opacity-30 transition-opacity cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {isStreaming ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="p-8 text-muted">Loading...</div>
        </AppShell>
      }
    >
      <ChatContent />
    </Suspense>
  )
}
