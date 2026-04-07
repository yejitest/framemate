'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Zap,
  Puzzle,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Agent Chat', icon: MessageSquare },
  { href: '/plugin', label: 'Figma Plugin', icon: Puzzle },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 h-full flex flex-col shrink-0 bg-white border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center shadow-sm shadow-violet-200">
            <Zap size={14} strokeWidth={1.5} className="text-white" />
          </div>
          <span className="text-fg font-bold text-sm tracking-tight" style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}>
            Framemate
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative ${
                active
                  ? 'bg-fg text-white font-semibold'
                  : 'text-muted hover:text-fg hover:bg-gray-50'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={1.5}
                className={active ? 'text-white' : 'text-muted'}
              />
              <span style={{ fontFamily: 'Pretendard, Inter, sans-serif' }}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-xs text-muted font-mono">v0.1.0-alpha</p>
      </div>
    </aside>
  )
}
