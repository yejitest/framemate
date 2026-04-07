'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { type Task } from '@/types'
import {
  Component,
  Monitor,
  ShieldCheck,
  Clock,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react'

const quickActions = [
  {
    icon: Component,
    label: '컴포넌트 생성',
    description: '버튼, 카드, 인풋 등 UI 컴포넌트를 자연어로 생성',
    href: '/chat?mode=component',
    available: true,
  },
  {
    icon: Monitor,
    label: '스크린 스캐폴딩',
    description: '전체 페이지 레이아웃을 디자인 시스템 기반으로 구성',
    href: '/chat?mode=screen',
    available: true,
  },
  {
    icon: ShieldCheck,
    label: 'QA 체커',
    description: '디자인 일관성 및 접근성 검토 (출시 예정)',
    href: '#',
    available: false,
  },
]

function formatRelative(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('framemate:tasks')
    if (stored) {
      try {
        setTasks(JSON.parse(stored))
      } catch {
        setTasks([])
      }
    }
  }, [])

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-4xl" style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}>
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-full px-3 py-1 mb-4">
            <Sparkles size={11} className="text-violet-600" />
            <span className="text-xs text-violet-600 font-semibold">AI Design Agent</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-fg">
            What are we designing today?
          </h1>
          <p className="text-sm text-muted">
            자연어로 요청하면 Figma에 바로 그려드립니다
          </p>
        </div>

        {/* Quick Actions */}
        <section className="mb-10">
          <h2 className="text-xs text-muted uppercase tracking-widest mb-4 font-semibold">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {quickActions.map(({ icon: Icon, label, description, href, available }) => (
              <Link
                key={label}
                href={available ? href : '#'}
                className={`group card-shadow block p-5 transition-all duration-200 ${
                  available
                    ? 'card-hover-purple cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      className={available ? 'text-violet-600' : 'text-muted'}
                    />
                  </div>
                  {!available && <Badge variant="muted">Soon</Badge>}
                  {available && (
                    <ArrowRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-muted group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all"
                    />
                  )}
                </div>
                <p className="text-sm font-bold text-fg mb-1">{label}</p>
                <p className="text-xs text-muted leading-relaxed">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Tasks */}
        <section>
          <h2 className="text-xs text-muted uppercase tracking-widest mb-4 font-semibold">
            Recent Tasks
          </h2>

          {tasks.length === 0 ? (
            <div className="card-shadow p-10 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-border flex items-center justify-center mx-auto mb-3">
                <Clock size={18} strokeWidth={1.5} className="text-muted" />
              </div>
              <p className="text-sm text-muted font-medium">아직 작업 히스토리가 없습니다</p>
              <p className="text-xs text-muted/70 mt-1">
                Agent Chat에서 첫 번째 작업을 시작해보세요
              </p>
              <div className="mt-5">
                <Link href="/chat">
                  <Button variant="primary" pill className="text-xs shadow-none">
                    Chat 시작하기
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="card-shadow overflow-hidden" style={{ padding: 0 }}>
              {tasks.map((task, i) => (
                <Link
                  key={task.id}
                  href={`/result/${task.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  style={i < tasks.length - 1 ? { borderBottom: '1px solid #E4E4E7' } : {}}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg font-medium truncate">{task.prompt}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={task.mode === 'component' ? 'agent' : 'screen'}>
                        {task.mode === 'component' ? '컴포넌트' : '스크린'}
                      </Badge>
                      <span className="text-xs text-muted font-mono">
                        {formatRelative(task.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                        ? '완료'
                        : task.status === 'error'
                        ? '오류'
                        : task.status === 'running'
                        ? '진행중'
                        : '대기'}
                    </Badge>
                    {task.figmaLink && (
                      <ExternalLink size={13} strokeWidth={1.5} className="text-muted" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
