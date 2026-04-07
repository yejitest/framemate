'use client'

import { useEffect, useState } from 'react'
import { Zap, CheckCircle, MousePointer2 } from 'lucide-react'

const STEPS = [
  { label: 'Frame 생성 중...', done: 'Frame 생성 완료' },
  { label: 'Primary 버튼 생성 중...', done: 'Primary 완료' },
  { label: 'Secondary 버튼 생성 중...', done: 'Secondary 완료' },
  { label: 'Ghost 버튼 생성 중...', done: 'Ghost 완료' },
  { label: 'Auto Layout 정리 중...', done: '3 variants 완성' },
]

const STEP_DURATION = 900
const HOLD_DURATION = 2800
const RESET_DELAY   = 700

/* ── Canvas: Figma-like preview ── */
function FigmaCanvas({ completedUpTo, isDone, isRunning }: {
  completedUpTo: number
  isDone: boolean
  isRunning: boolean
}) {
  const showFrame    = completedUpTo >= 0 || isDone
  const showPrimary  = completedUpTo >= 1 || isDone
  const showSecondary = completedUpTo >= 2 || isDone
  const showGhost    = completedUpTo >= 3 || isDone

  return (
    <div
      className="relative flex-1 rounded-xl overflow-hidden"
      style={{
        background: '#F0F0F0',
        backgroundImage: 'radial-gradient(circle, #C8C8C8 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        minHeight: 220,
      }}
    >
      {/* Figma-style zoom label */}
      <div className="absolute bottom-2.5 left-3 text-[10px] text-gray-400 font-mono select-none">
        100%
      </div>

      {/* Cursor pointer decoration */}
      {isRunning && !isDone && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            top: completedUpTo < 1 ? '38%' : completedUpTo < 2 ? '52%' : completedUpTo < 3 ? '66%' : '72%',
            left: '54%',
            transition: 'top 0.6s ease',
          }}
        >
          <MousePointer2 size={14} className="text-violet-500 drop-shadow" fill="#7C3AED" fillOpacity={0.15} />
        </div>
      )}

      {/* Component frame */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: '20px 24px' }}
      >
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: showFrame ? 1 : 0,
            transform: showFrame ? 'scale(1)' : 'scale(0.96)',
          }}
        >
          {/* Frame label */}
          <div
            className="text-[10px] font-medium mb-1.5 transition-all duration-300"
            style={{
              color: isDone ? '#7C3AED' : '#9CA3AF',
              opacity: showFrame ? 1 : 0,
            }}
          >
            Button / Component
          </div>

          {/* Frame border */}
          <div
            className="rounded-xl p-4 transition-all duration-500"
            style={{
              border: isDone ? '1.5px solid #7C3AED40' : '1.5px dashed #D1D5DB',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(4px)',
              boxShadow: isDone ? '0 4px 24px rgba(124,58,237,0.08)' : 'none',
            }}
          >
            {/* Auto Layout hint */}
            {isDone && (
              <div className="flex items-center gap-1 mb-3 opacity-60">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="#7C3AED" strokeWidth="1.2"/>
                  <line x1="3.5" y1="1" x2="3.5" y2="9" stroke="#7C3AED" strokeWidth="0.8" strokeDasharray="1.5 1"/>
                  <line x1="6.5" y1="1" x2="6.5" y2="9" stroke="#7C3AED" strokeWidth="0.8" strokeDasharray="1.5 1"/>
                </svg>
                <span className="text-[9px] text-violet-500 font-medium">Auto Layout</span>
              </div>
            )}

            <div className="space-y-2.5">
              {/* Primary */}
              <div
                className="flex items-center gap-3 transition-all duration-400"
                style={{ opacity: showPrimary ? 1 : 0, transform: showPrimary ? 'translateX(0)' : 'translateX(-6px)' }}
              >
                <div className="relative">
                  {!showSecondary && showPrimary && (
                    <div className="absolute -inset-0.5 rounded-lg border border-violet-400 animate-pulse pointer-events-none" />
                  )}
                  <button className="text-xs font-semibold px-4 py-2 rounded-lg text-white select-none" style={{ background: '#0F0F1A', letterSpacing: '-0.01em' }}>
                    Get Started
                  </button>
                </div>
                <span className="text-[9px] font-medium text-gray-400">Primary</span>
              </div>

              {/* Secondary */}
              <div
                className="flex items-center gap-3 transition-all duration-400"
                style={{ opacity: showSecondary ? 1 : 0, transform: showSecondary ? 'translateX(0)' : 'translateX(-6px)', transitionDelay: '60ms' }}
              >
                <div className="relative">
                  {!showGhost && showSecondary && (
                    <div className="absolute -inset-0.5 rounded-lg border border-violet-400 animate-pulse pointer-events-none" />
                  )}
                  <button className="text-xs font-semibold px-4 py-2 rounded-lg select-none" style={{ background: 'white', color: '#0F0F1A', border: '1.5px solid #0F0F1A', letterSpacing: '-0.01em' }}>
                    Learn More
                  </button>
                </div>
                <span className="text-[9px] font-medium text-gray-400">Secondary</span>
              </div>

              {/* Ghost */}
              <div
                className="flex items-center gap-3 transition-all duration-400"
                style={{ opacity: showGhost ? 1 : 0, transform: showGhost ? 'translateX(0)' : 'translateX(-6px)', transitionDelay: '120ms' }}
              >
                <div className="relative">
                  {isDone && (
                    <div className="absolute -inset-0.5 rounded-lg pointer-events-none" />
                  )}
                  {!isDone && showGhost && (
                    <div className="absolute -inset-0.5 rounded-lg border border-violet-400 animate-pulse pointer-events-none" />
                  )}
                  <button className="text-xs font-semibold px-4 py-2 rounded-lg select-none" style={{ background: 'transparent', color: '#0F0F1A', letterSpacing: '-0.01em' }}>
                    Skip
                  </button>
                </div>
                <span className="text-[9px] font-medium text-gray-400">Ghost</span>
              </div>
            </div>
          </div>

          {/* Token chips row */}
          {isDone && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap" style={{ animation: 'fadeInUp 0.4s ease forwards' }}>
              {[
                { color: '#0F0F1A', label: 'fg' },
                { color: '#7C3AED', label: 'accent' },
                { color: '#F7F7FA', label: 'surface', border: '#E4E4E7' },
              ].map(({ color, label, border }) => (
                <div key={label} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: color, border: border ? `1px solid ${border}` : undefined }}
                  />
                  <span className="text-[9px] text-gray-500 font-mono">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main ── */
export function HeroDemo() {
  const [phase, setPhase] = useState<'typing' | 'running' | 'done' | 'reset'>('reset')
  const [stepIndex, setStepIndex] = useState(-1)
  const [completedUpTo, setCompletedUpTo] = useState(-1)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>

    if (phase === 'reset') {
      setStepIndex(-1)
      setCompletedUpTo(-1)
      t = setTimeout(() => setPhase('typing'), RESET_DELAY)
    }

    if (phase === 'typing') {
      t = setTimeout(() => { setPhase('running'); setStepIndex(0) }, 1200)
    }

    if (phase === 'running') {
      if (stepIndex < 0) return
      if (stepIndex > 0) setCompletedUpTo(stepIndex - 1)
      if (stepIndex < STEPS.length) {
        t = setTimeout(() => setStepIndex((i) => i + 1), STEP_DURATION)
      } else {
        setCompletedUpTo(STEPS.length - 1)
        t = setTimeout(() => setPhase('done'), 300)
      }
    }

    if (phase === 'done') {
      t = setTimeout(() => setPhase('reset'), HOLD_DURATION)
    }

    return () => clearTimeout(t)
  }, [phase, stepIndex])

  const showUserMsg = phase !== 'reset'
  const showAgent   = phase === 'running' || phase === 'done'
  const isDone      = phase === 'done'
  const isRunning   = phase === 'running'
  const currentStep = phase === 'running' ? stepIndex : STEPS.length

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="mt-14 mx-auto card-shadow overflow-hidden text-left"
        style={{ maxWidth: 680, fontFamily: 'Pretendard, Inter, sans-serif', borderRadius: 20 }}
      >
        {/* ── Header ── */}
        <div className="bg-gray-50 px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="w-5 h-5 rounded btn-gradient flex items-center justify-center">
              <Zap size={10} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-fg">Framemate Agent</span>
          </div>
          <span
            className={`text-xs rounded-full px-2.5 py-0.5 font-medium border transition-all duration-300 ${
              isDone
                ? 'bg-green-50 text-green-600 border-green-200'
                : isRunning
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-gray-100 text-gray-400 border-gray-200'
            }`}
          >
            {isDone ? '✓ Done' : isRunning ? '⟳ Running' : 'Idle'}
          </span>
        </div>

        {/* ── Body: Chat + Canvas ── */}
        <div className="flex" style={{ minHeight: 260 }}>

          {/* Left: Chat */}
          <div className="w-52 flex-shrink-0 border-r border-border p-3.5 flex flex-col gap-3 bg-white">

            {/* User bubble */}
            <div
              className="flex justify-end transition-all duration-500"
              style={{ opacity: showUserMsg ? 1 : 0, transform: showUserMsg ? 'translateY(0)' : 'translateY(6px)' }}
            >
              <div className="bg-fg text-white text-[11px] leading-relaxed px-3 py-2 rounded-2xl rounded-br-sm max-w-full">
                버튼 컴포넌트 만들어줘.<br />
                Primary / Secondary / Ghost
              </div>
            </div>

            {/* Agent steps */}
            {showAgent && (
              <div className="flex items-start gap-1.5">
                <div className="w-5 h-5 rounded-md bg-fg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={9} className="text-white" />
                </div>
                <div className="flex-1 bg-gray-50 border border-border rounded-xl rounded-tl-sm px-2.5 py-2 space-y-1.5">
                  {STEPS.map((step, i) => {
                    if (i >= currentStep) return null
                    const isComplete = i <= completedUpTo
                    const isActive   = i === currentStep - 1 && !isComplete
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        {isComplete ? (
                          <CheckCircle size={10} className="text-green-500 flex-shrink-0" />
                        ) : isActive ? (
                          <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-gray-400 border-t-transparent animate-spin flex-shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-gray-200 flex-shrink-0" />
                        )}
                        <span className={`text-[10px] leading-tight ${isComplete ? 'text-fg' : isActive ? 'text-muted' : 'text-muted/40'}`}>
                          {isComplete ? step.done : step.label}
                        </span>
                      </div>
                    )
                  })}

                  {!isDone && currentStep === 0 && (
                    <div className="flex items-center gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1 h-1 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Canvas */}
          <FigmaCanvas completedUpTo={completedUpTo} isDone={isDone} isRunning={isRunning} />
        </div>
      </div>
    </>
  )
}
