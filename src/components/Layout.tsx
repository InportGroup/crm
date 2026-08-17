import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth'

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: 'M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-3.5v-4h-5v4H4a1 1 0 0 1-1-1v-5.5Z' },
  { to: '/contacts', label: 'Contacts', icon: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 6a6 6 0 1 1 12 0v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V16Z' },
  { to: '/companies', label: 'Companies', icon: 'M4 3h8a1 1 0 0 1 1 1v13H3V4a1 1 0 0 1 1-1Zm10 6h2a1 1 0 0 1 1 1v7h-3V9ZM6 6h2v2H6V6Zm0 4h2v2H6v-2Zm3-4h2v2H9V6Zm0 4h2v2H9v-2Z' },
  { to: '/deals', label: 'Deals', icon: 'M10 2a1 1 0 0 1 1 1v.6a3.5 3.5 0 0 1 2.5 2 1 1 0 1 1-1.8.8A1.5 1.5 0 0 0 10 5.5c-1 0-1.7.5-1.7 1.1 0 .6.5.9 2 1.3 1.7.4 3.2 1 3.2 2.9 0 1.5-1.1 2.5-2.5 2.8v.9a1 1 0 1 1-2 0v-.9a3.6 3.6 0 0 1-2.6-2 1 1 0 1 1 1.8-.9c.3.6.9 1 1.8 1 1.1 0 1.6-.5 1.6-1 0-.6-.6-.9-2-1.3C7.8 9 6.3 8.4 6.3 6.6c0-1.4 1.1-2.5 2.7-2.9V3a1 1 0 0 1 1-1Z' },
  { to: '/tasks', label: 'Tasks', icon: 'M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2.7 5.3a1 1 0 0 0-1.4 1.4l1.5 1.5a1 1 0 0 0 1.4 0l3.5-3.5a1 1 0 0 0-1.4-1.4L7.5 10.1l-.8-.8Z' },
]

export function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
            <path d={item.icon} />
          </svg>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Brand />
        <div className="flex-1 px-3 py-4">{nav}</div>
        <UserCard email={user?.email ?? ''} onSignOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Brand compact />
        <button
          type="button"
          className="btn-ghost px-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
            <path d="M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z" />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="border-b border-slate-200 bg-white px-3 py-3 lg:hidden">
          {nav}
          <div className="mt-3 border-t border-slate-200 pt-3">
            <UserCard email={user?.email ?? ''} onSignOut={signOut} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'border-b border-slate-200 px-5 py-4'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        C
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900">Clientela</span>
    </div>
  )
}

function UserCard({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="flex items-center gap-3 border-slate-200 px-3 py-3 lg:border-t">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 uppercase">
        {email.charAt(0) || '?'}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-600" title={email}>
        {email}
      </span>
      <button type="button" onClick={() => void onSignOut()} className="btn-ghost px-2" title="Sign out">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M4 4a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H6v10h4a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V4Zm9.3 2.3a1 1 0 0 1 1.4 0l2.5 2.5a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 0 1-1.4-1.4l.8-.8H10a1 1 0 1 1 0-2h4.1l-.8-.8a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
    </div>
  )
}
