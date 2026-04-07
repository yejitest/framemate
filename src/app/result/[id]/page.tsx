'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { type Task } from '@/types'
import {
  ArrowLeft,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  PenTool,
} from 'lucide-react'

export default function ResultPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [task, setTask] = useState<Task | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('framemate:tasks')
    if (stored) {
      try {
        const tasks: Task[] = JSON.parse(stored)
        const found = tasks.find((t) => t.id === params.id)
        setTask(found ?? null)
      } catch {
        setTask(null)
      }
    }
  }, [params.id])

  if (!task) {
    return (
      <AppShell>
        <div className="px-8 py-8">
          <div className="text-center py-20">
            <p className="text-muted text-sm" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              작업을 찾을 수 없습니다
            </p>
            <div className="mt-4">
              <Link href="/dashboard">
                <Button variant="secondary" className="text-xs">
                  대시보드로 이동
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  const statusIcon = {
    success: <CheckCircle2 size={16} strokeWidth={1.5} className="text-[#4ADE80]" />,
    error: <XCircle size={16} strokeWidth={1.5} className="text-[#F87171]" />,
    running: <Loader2 size={16} strokeWidth={1.5} className="text-[#FCD34D] animate-spin" />,
    pending: <Loader2 size={16} strokeWidth={1.5} className="text-muted" />,
  }

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-2xl">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-6 cursor-pointer"
          style={{ fontFamily: 'Pretendard, sans-serif' }}
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          뒤로 가기
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {statusIcon[task.status]}
            <Badge
              variant={
                task.status === 'success'
                  ? 'success'
                  : task.status === 'error'
                  ? 'danger'
                  : 'warning'
              }
            >
              {task.status === 'success'
                ? '생성 완료'
                : task.status === 'error'
                ? '생성 실패'
                : task.status === 'running'
                ? '생성 중'
                : '대기'}
            </Badge>
            <Badge variant={task.mode === 'component' ? 'agent' : 'muted'}>
              {task.mode === 'component' ? '컴포넌트' : '스크린'}
            </Badge>
          </div>
          <h1
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}
          >
            Task Result
          </h1>
        </div>

        {/* Request card */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <p
            className="text-xs text-muted uppercase tracking-widest mb-2"
            style={{ fontFamily: 'var(--font-space-mono)' }}
          >
            요청 내용
          </p>
          <p
            className="text-sm text-fg leading-relaxed"
            style={{ fontFamily: 'Pretendard, sans-serif' }}
          >
            {task.prompt}
          </p>
          {task.summary && (
            <>
              <div className="border-t border-border mt-4 pt-4">
                <p
                  className="text-xs text-muted uppercase tracking-widest mb-2"
                  style={{ fontFamily: 'var(--font-space-mono)' }}
                >
                  에이전트 요약
                </p>
                <p
                  className="text-sm text-fg/80 leading-relaxed"
                  style={{ fontFamily: 'Pretendard, sans-serif' }}
                >
                  {task.summary}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Figma link */}
        {task.figmaLink && (
          <div className="bg-surface border border-border rounded-xl p-5 mb-4">
            <p
              className="text-xs text-muted uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-space-mono)' }}
            >
              Figma 파일
            </p>
            <a
              href={task.figmaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-agent/15 flex items-center justify-center shrink-0">
                <PenTool size={14} strokeWidth={1.5} className="text-[#A78BFA]" />
              </div>
              <span
                className="text-sm text-[#A78BFA] group-hover:underline truncate flex-1"
                style={{ fontFamily: 'var(--font-space-mono)', fontSize: '12px' }}
              >
                {task.figmaLink}
              </span>
              <ExternalLink
                size={13}
                strokeWidth={1.5}
                className="text-muted shrink-0 group-hover:text-fg transition-colors"
              />
            </a>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p
                className="text-xs text-muted uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-space-mono)' }}
              >
                Task ID
              </p>
              <p
                className="text-xs text-fg/70"
                style={{ fontFamily: 'var(--font-space-mono)' }}
              >
                {task.id}
              </p>
            </div>
            <div>
              <p
                className="text-xs text-muted uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-space-mono)' }}
              >
                Created
              </p>
              <p
                className="text-xs text-fg/70"
                style={{ fontFamily: 'var(--font-space-mono)' }}
              >
                {new Date(task.createdAt).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link href={`/chat?mode=${task.mode}`}>
            <Button variant="secondary" className="text-xs h-9 gap-2">
              <RotateCcw size={13} strokeWidth={1.5} />
              재요청
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-xs h-9">
              대시보드로
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
