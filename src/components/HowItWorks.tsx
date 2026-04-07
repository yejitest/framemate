'use client'

import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'

/* ── Shared helpers ── */
function useVisible(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(10px)',
        animation: `fadeInUp 0.5s ease forwards`,
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Step 1: Chat typing ── */
function Step1Demo() {
  const { ref, visible } = useVisible()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) return
    setStep(0)
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1400),
      setTimeout(() => setStep(3), 2600),
    ]
    const reset = setTimeout(() => { setStep(0); }, 5000)
    return () => { [...timers, reset].forEach(clearTimeout) }
  }, [visible])

  // re-trigger loop
  useEffect(() => {
    if (step !== 0 || !visible) return
    const t = setTimeout(() => setStep(1), 400)
    return () => clearTimeout(t)
  }, [step, visible])

  return (
    <div ref={ref} className="bg-white border border-border rounded-2xl p-4 space-y-3 max-w-sm w-full" style={{ minHeight: 140 }}>
      {step >= 1 && (
        <div className="flex justify-end" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="bg-fg text-white text-xs px-3 py-2 rounded-xl leading-relaxed max-w-[85%]">
            로그인 폼 만들어줘.<br />이메일 + 비밀번호 + 소셜 로그인 3개
          </div>
        </div>
      )}
      {step >= 2 && (
        <div className="flex items-start gap-2" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="w-5 h-5 rounded-md bg-fg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={9} className="text-white" />
          </div>
          <div className="bg-gray-50 border border-border text-xs px-3 py-2 rounded-xl text-muted leading-relaxed">
            로그인 폼 생성을 시작할게요.
          </div>
        </div>
      )}
      {step >= 3 && (
        <div className="flex items-start gap-2" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="w-5 h-5 rounded-md bg-fg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={9} className="text-white" />
          </div>
          <div className="bg-gray-50 border border-border text-xs px-3 py-2 rounded-xl text-fg leading-relaxed">
            디자인 시스템 컴포넌트를 확인합니다...
            <span className="inline-flex gap-0.5 ml-1">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-muted inline-block animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Step 2: Token scan ── */
const TOKENS = [
  { color: 'bg-[#0F0F1A]', name: 'color/primary', hex: '#0F0F1A' },
  { color: 'bg-violet-500', name: 'color/accent', hex: '#7C3AED' },
  { color: 'bg-gray-100 border border-border', name: 'color/surface', hex: '#F7F7FA' },
]

function Step2Demo() {
  const { ref, visible } = useVisible()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!visible) return
    setCount(0)
    const timers = TOKENS.map((_, i) => setTimeout(() => setCount(i + 1), 400 + i * 500))
    const reset = setTimeout(() => setCount(0), 3800)
    return () => [...timers, reset].forEach(clearTimeout)
  }, [visible])

  useEffect(() => {
    if (count !== 0 || !visible) return
    const t = setTimeout(() => setCount(1), 400)
    return () => clearTimeout(t)
  }, [count, visible])

  return (
    <div ref={ref} className="bg-white border border-border rounded-2xl p-4 max-w-sm w-full">
      <div className="bg-gray-50 border border-border rounded-lg px-3 py-2 text-xs text-muted font-mono mb-4">
        figma.com/file/AbC123...
      </div>
      <div className="space-y-2.5">
        {TOKENS.map(({ color, name, hex }, i) => (
          <div
            key={name}
            className="flex items-center gap-2.5 transition-all duration-400"
            style={{
              opacity: i < count ? 1 : 0,
              transform: i < count ? 'translateX(0)' : 'translateX(-8px)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}
          >
            <div className={`w-4 h-4 rounded flex-shrink-0 ${color}`} />
            <span className="text-xs text-muted font-mono flex-1">{name}</span>
            <span className="text-xs text-muted">{hex}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Step 3: Progress check ── */
const ITEMS = [
  'Frame — Login Form',
  'Input — Email',
  'Input — Password',
  'Button — Primary CTA',
  'Divider + 소셜 버튼 3개',
]

function Step3Demo() {
  const { ref, visible } = useVisible()
  const [done, setDone] = useState(0)

  useEffect(() => {
    if (!visible) return
    setDone(0)
    const timers = ITEMS.map((_, i) => setTimeout(() => setDone(i + 1), 300 + i * 600))
    const reset = setTimeout(() => setDone(0), 4500)
    return () => [...timers, reset].forEach(clearTimeout)
  }, [visible])

  useEffect(() => {
    if (done !== 0 || !visible) return
    const t = setTimeout(() => setDone(1), 300)
    return () => clearTimeout(t)
  }, [done, visible])

  return (
    <div ref={ref} className="space-y-2.5 max-w-sm w-full">
      {ITEMS.map((label, i) => {
        const isChecked = i < done
        const isActive  = i === done

        return (
          <div key={label} className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300"
              style={{
                background: isChecked ? '#22c55e' : 'transparent',
                border: isChecked ? 'none' : isActive ? '2px solid #9ca3af' : '2px solid #e4e4e7',
              }}
            >
              {isChecked && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {isActive && (
                <span
                  className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin block"
                  style={{ margin: '-3px' }}
                />
              )}
            </div>
            <span
              className="text-sm transition-colors duration-300"
              style={{ color: isChecked ? '#0F0F1A' : isActive ? '#71717A' : '#D4D4D8' }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Step 4: Chat revision ── */
function Step4Demo() {
  const { ref, visible } = useVisible()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!visible) return
    setStep(0)
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1600),
      setTimeout(() => setStep(3), 2800),
    ]
    const reset = setTimeout(() => setStep(0), 5400)
    return () => [...timers, reset].forEach(clearTimeout)
  }, [visible])

  useEffect(() => {
    if (step !== 0 || !visible) return
    const t = setTimeout(() => setStep(1), 400)
    return () => clearTimeout(t)
  }, [step, visible])

  return (
    <div ref={ref} className="space-y-3 max-w-sm w-full" style={{ minHeight: 140 }}>
      {step >= 1 && (
        <div className="flex items-start gap-2" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="w-5 h-5 rounded-md bg-fg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={9} className="text-white" />
          </div>
          <div className="bg-white border border-border text-xs px-3 py-2 rounded-xl text-fg leading-relaxed">
            로그인 폼 완성했어요. Figma에서 확인해보세요 →
          </div>
        </div>
      )}
      {step >= 2 && (
        <div className="flex justify-end" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="bg-fg text-white text-xs px-3 py-2 rounded-xl max-w-[85%] leading-relaxed">
            버튼 검은색으로, 폼 너비 더 좁게 바꿔줘
          </div>
        </div>
      )}
      {step >= 3 && (
        <div className="flex items-start gap-2" style={{ animation: 'fadeInUp 0.35s ease forwards' }}>
          <div className="w-5 h-5 rounded-md bg-fg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={9} className="text-white" />
          </div>
          <div className="bg-white border border-border text-xs px-3 py-2 rounded-xl text-fg leading-relaxed">
            버튼 #0F0F1A 적용, 너비 360→320px 수정 완료 ✓
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main export ── */
const STEPS = [
  {
    num: 'Step 1',
    title: '자연어로 요청하세요',
    desc: '동료에게 말하듯 원하는 UI를 설명하면 됩니다. 복잡한 명세서 없이도 Framemate가 의도를 파악합니다.',
    demo: <Step1Demo />,
    reverse: false,
  },
  {
    num: 'Step 2',
    title: '디자인 시스템을 연결하세요',
    desc: 'Figma 파일 URL만 입력하면 컬러 토큰, 타이포그래피, 컴포넌트를 자동으로 인식합니다.',
    demo: <Step2Demo />,
    reverse: true,
  },
  {
    num: 'Step 3',
    title: 'Figma에 바로 그려집니다',
    desc: '에이전트가 Auto Layout, 컴포넌트 배치, 간격을 자동으로 적용하며 Figma 캔버스에 실시간으로 그립니다.',
    demo: <Step3Demo />,
    reverse: false,
  },
  {
    num: 'Step 4',
    title: '말 한마디로 수정하세요',
    desc: '결과가 마음에 들지 않으면 피드백을 주세요. 대화 맥락이 유지되어 즉시 반영됩니다.',
    demo: <Step4Demo />,
    reverse: true,
  },
]

export function HowItWorks() {
  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section id="how-it-works" className="section-alt py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-fg">How Framemate works</h2>
          </div>

          <div className="space-y-16">
            {STEPS.map(({ num, title, desc, demo, reverse }, i) => (
              <div key={num}>
                <div className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16`}>
                  <div className="md:w-72 flex-shrink-0">
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">{num}</span>
                    <h3 className="text-xl font-bold text-fg mt-2 mb-3">{title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{desc}</p>
                  </div>
                  <div className={`flex-1 w-full flex ${reverse ? 'justify-start' : 'md:justify-end'}`}>
                    {demo}
                  </div>
                </div>
                {i < STEPS.length - 1 && <div className="border-t border-border mt-16" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
