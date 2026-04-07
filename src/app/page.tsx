import Link from 'next/link'
import {
  Zap,
  Component,
  Monitor,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { HeroDemo } from '@/components/HeroDemo'
import { HowItWorks } from '@/components/HowItWorks'




const faqs = [
  {
    q: 'Framemate는 기존 챗봇과 어떻게 다른가요?',
    a: 'Framemate 에이전트는 단순히 답변하지 않습니다. Figma API를 통해 직접 컴포넌트를 생성하고, 레이아웃을 구성하며, 모든 단계를 기록합니다.',
  },
  {
    q: '개발자 없이 사용할 수 있나요?',
    a: '네. 준비된 템플릿에서 시작하거나, 원하는 내용을 설명하기만 하면 에이전트가 Figma에 바로 그려줍니다. 코드가 전혀 필요 없습니다.',
  },
  {
    q: '기존 Figma 파일과 연동되나요?',
    a: '물론입니다. Figma 파일 URL을 채팅에 붙여넣으면 기존 디자인 시스템, 컬러 토큰, 컴포넌트를 자동으로 인식합니다.',
  },
  {
    q: '사람이 중간에 개입할 수 있나요?',
    a: '항상 가능합니다. 민감한 작업은 사용자 승인 후에만 실행됩니다. 전체 가시성과 통제권을 유지합니다.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-fg" style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}>

      {/* ── Navbar ── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav className="w-full max-w-5xl bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center">
                <Zap size={14} strokeWidth={1.5} className="text-white" />
              </div>
              <span className="font-bold text-sm text-fg tracking-tight">Framemate</span>
            </Link>

            <div className="hidden md:flex items-center gap-7">
              <a href="#how-it-works" className="text-sm text-muted hover:text-fg transition-colors">How it works</a>
              <a href="#actions" className="text-sm text-muted hover:text-fg transition-colors">Features</a>
              <a href="#faq" className="text-sm text-muted hover:text-fg transition-colors">FAQ</a>
            </div>

            <Link
              href="/dashboard"
              className="btn-gradient text-white text-sm font-semibold px-5 py-2 rounded-full inline-flex items-center gap-1.5"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </div>

      {/* ── Hero ── */}
      <section className="hero-bg pt-36 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-5 text-fg">
            Just describe it.<br />
            <span className="gradient-text">Figma does the rest.</span>
          </h1>
          <p className="text-base text-muted mb-10 max-w-lg mx-auto leading-relaxed">
            컴포넌트 이름만 불러도, 화면 구조만 설명해도 —<br />
            Framemate가 디자인 시스템을 읽고 Figma에 바로 그려드립니다.
          </p>

          <Link
            href="/dashboard"
            className="btn-gradient text-white font-semibold px-8 py-3.5 rounded-full inline-flex items-center gap-2 text-sm shadow-lg shadow-black/10"
          >
            Get Started
          </Link>

          <HeroDemo />
        </div>
      </section>

      <HowItWorks />

      {/* ── What you can do ── */}
      <section id="actions" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-fg">What you can do</h2>
            <p className="text-muted mt-3 text-sm max-w-xl mx-auto">
              자주 쓰는 디자인 작업을 템플릿으로 바로 실행하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Component,
                label: '컴포넌트 생성',
                desc: '버튼, 카드, 인풋 등 UI 컴포넌트를 자연어로 즉시 생성합니다.',
                href: '/chat?mode=component',
                badge: null,
              },
              {
                icon: Monitor,
                label: '스크린 스캐폴딩',
                desc: '전체 페이지 레이아웃을 디자인 시스템 기반으로 자동 구성합니다.',
                href: '/chat?mode=screen',
                badge: null,
              },
              {
                icon: ShieldCheck,
                label: 'QA 체커',
                desc: '디자인 일관성 및 접근성을 자동으로 검토합니다.',
                href: '#',
                badge: 'Soon',
              },
            ].map(({ icon: Icon, label, desc, href, badge }) => (
              <Link
                key={label}
                href={href}
                className={`card-shadow ${!badge ? 'card-hover-purple' : 'opacity-60 pointer-events-none'} p-6 text-center block`}
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
                  <Icon size={20} strokeWidth={1.5} className="text-violet-600" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-base font-bold text-fg">{label}</h3>
                  {badge && (
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-fg">FAQ</h2>
          </div>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="card-shadow p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm font-bold text-fg">{q}</h3>
                  <ChevronDown size={16} className="text-muted flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-sm text-muted leading-relaxed mt-3">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6" style={{ background: '#0F0F1A' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            크레딧 카드 없이 무료로 시작할 수 있습니다. Figma 파일만 있으면 됩니다.
          </p>
          <Link
            href="/dashboard"
            className="bg-white text-fg font-semibold px-8 py-4 rounded-full inline-flex items-center gap-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Start today
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-border py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md btn-gradient flex items-center justify-center">
              <Zap size={11} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-sm font-bold text-fg">Framemate</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xs text-muted hover:text-fg transition-colors">Dashboard</Link>
            <Link href="/chat" className="text-xs text-muted hover:text-fg transition-colors">Agent Chat</Link>
            <Link href="/settings" className="text-xs text-muted hover:text-fg transition-colors">Settings</Link>
          </div>
          <p className="text-xs text-muted">v0.1.0-alpha · Built for designers</p>
        </div>
      </footer>
    </div>
  )
}
