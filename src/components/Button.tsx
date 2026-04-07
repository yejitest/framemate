import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
  loading?: boolean
  pill?: boolean
}

export function Button({
  variant = 'primary',
  children,
  loading,
  disabled,
  pill,
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-semibold transition-all duration-150 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none'
  const radius = pill ? 'rounded-full' : 'rounded-lg'

  const variantClass =
    variant === 'primary'
      ? 'btn-gradient text-white shadow-sm shadow-black/10'
      : variant === 'secondary'
      ? 'bg-white text-fg border border-border hover:border-gray-300 hover:bg-gray-50'
      : 'bg-transparent text-muted hover:text-fg'

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${radius} ${variantClass} ${className}`}
      style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : null}
      {children}
    </button>
  )
}
