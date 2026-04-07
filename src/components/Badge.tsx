import { type ReactNode } from 'react'

type BadgeVariant = 'agent' | 'screen' | 'success' | 'warning' | 'danger' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  agent: 'bg-violet-50 border border-violet-200 text-violet-700',
  screen: 'bg-blue-50 border border-blue-200 text-blue-600',
  success: 'bg-green-50 border border-green-200 text-green-700',
  warning: 'bg-amber-50 border border-amber-200 text-amber-700',
  danger: 'bg-red-50 border border-red-200 text-red-700',
  muted: 'bg-gray-100 border border-gray-200 text-gray-500',
}

export function Badge({ variant = 'muted', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${variantStyles[variant]}`}
      style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}
    >
      {children}
    </span>
  )
}
