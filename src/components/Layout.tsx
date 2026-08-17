import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useTheme } from '../context/theme'
import { Logo } from './Logo'
import { CommandPalette } from './CommandPalette'

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: 'M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-3.5v-4h-5v4H4a1 1 0 0 1-1-1v-5.5Z',
  },
  {
    to: '/contacts',
    label: 'Contacts',
    icon: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 6a6 6 0 1 1 12 0v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V16Z',
  },
  {
    to: '/companies',
    label: 'Companies',
    icon: 'M4 3h8a1 1 0 0 1 1 1v13H3V4a1 1 0 0 1 1-1Zm10 6h2a1 1 0 0 1 1 1v7h-3V9ZM6 6h2v2H6V6Zm0 4h2v2H6v-2Zm3-4h2v2H9V6Zm0 4h2v2H9v-2Z',
  },
  {
    to: '/deals',
    label: 'Deals',
    icon: 'M10 2a1 1 0 0 1 1 1v.6a3.5 3.5 0 0 1 2.5 2 1 1 0 1 1-1.8.8A1.5 1.5 0 0 0 10 5.5c-1 0-1.7.5-1.7 1.1 0 .6.5.9 2 1.3 1.7.4 3.2 1 3.2 2.9 0 1.5-1.1 2.5-2.5 2.8v.9a1 1 0 1 1-2 0v-.9a3.6 3.6 0 0 1-2.6-2 1 1 0 1 1 1.8-.9c.3.6.9 1 1.8 1 1.1 0 1.6-.5 1.6-1 0-.6-.6-.9-2-1.3C7.8 9 6.3 8.4 6.3 6.6c0-1.4 1.1-2.5 2.7-2.9V3a1 1 0 0 1 1-1Z',
  },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: 'M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2.7 5.3a1 1 0 0 0-1.4 1.4l1.5 1.5a1 1 0 0 0 1.4 0l3.5-3.5a1 1 0 0 0-1.4-1.4L7.5 10.1l-.8-.8Z',
  },
]

export function Layout() {
  const { user, signOut } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd/Ctrl-K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen lg:flex">
      {/* ---- Desktop sidebar ---- */}
      <aside className="border-line bg-surface hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="border-line border-b px-5 py-4">
          <Logo />
        </div>

        <div className="px-3 py-3">
          <SearchTrigger onClick={() => setSearchOpen(true)} />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-soft text-brand-ink'
                    : 'text-muted hover:bg-neutral-soft hover:text-ink'
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

        <UserCard email={user?.email ?? ''} onSignOut={signOut} />
      </aside>

      {/* ---- Mobile header ---- */}
      <header className="border-line bg-surface/85 sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md lg:hidden">
        <Logo size={28} />
        <div className="flex items-center gap-1">
          <IconButton label="Search" onClick={() => setSearchOpen(true)}>
            <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.8l3.4 3.4a1 1 0 0 0 1.4-1.4l-3.4-3.4A5.5 5.5 0 0 0 8.5 3Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z" />
          </IconButton>
          <ThemeToggle />
          <IconButton label="Sign out" onClick={() => void signOut()}>
            <path d="M4 4a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H6v10h4a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V4Zm9.3 2.3a1 1 0 0 1 1.4 0l2.5 2.5a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 0 1-1.4-1.4l.8-.8H10a1 1 0 1 1 0-2h4.1l-.8-.8a1 1 0 0 1 0-1.4Z" />
          </IconButton>
        </div>
      </header>

      {/* pb leaves room for the mobile tab bar */}
      <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
        <Outlet />
      </main>

      {/* ---- Mobile bottom tab bar ---- */}
      <nav className="border-line bg-surface/90 fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand' : 'text-subtle'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-brand-soft' : ''
                  }`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d={item.icon} />
                  </svg>
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-line-strong text-subtle hover:border-brand/40 hover:text-muted flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.8l3.4 3.4a1 1 0 0 0 1.4-1.4l-3.4-3.4A5.5 5.5 0 0 0 8.5 3Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z" />
      </svg>
      <span className="flex-1 text-left">Search…</span>
      <kbd className="border-line bg-canvas rounded border px-1.5 py-0.5 font-sans text-[10px]">
        ⌘K
      </kbd>
    </button>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      {theme === 'dark' ? (
        <path d="M10 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7-4a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 10a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm10.7-5.7a1 1 0 0 1 0 1.4l-.7.7a1 1 0 1 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0ZM6.4 13.6a1 1 0 0 1 0 1.4l-.7.7a1 1 0 0 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0Zm9.3 1.4a1 1 0 0 1-1.4 0l-.7-.7a1 1 0 1 1 1.4-1.4l.7.7a1 1 0 0 1 0 1.4ZM6.4 6.4A1 1 0 0 1 5 6.4l-.7-.7a1 1 0 0 1 1.4-1.4l.7.7a1 1 0 0 1 0 1.4ZM10 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
      ) : (
        <path d="M17 11.8A7 7 0 1 1 8.2 3a.8.8 0 0 1 1 1 5.6 5.6 0 0 0 6.8 6.8.8.8 0 0 1 1 1Z" />
      )}
    </IconButton>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted hover:bg-neutral-soft hover:text-ink rounded-lg p-2 transition-colors"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        {children}
      </svg>
    </button>
  )
}

function UserCard({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="border-line flex items-center gap-2.5 border-t px-3 py-3">
      <span className="bg-brand-soft text-brand-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
        {email.charAt(0) || '?'}
      </span>
      <span className="text-muted min-w-0 flex-1 truncate text-sm" title={email}>
        {email}
      </span>
      <ThemeToggle />
      <IconButton label="Sign out" onClick={() => void onSignOut()}>
        <path d="M4 4a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H6v10h4a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V4Zm9.3 2.3a1 1 0 0 1 1.4 0l2.5 2.5a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 0 1-1.4-1.4l.8-.8H10a1 1 0 1 1 0-2h4.1l-.8-.8a1 1 0 0 1 0-1.4Z" />
      </IconButton>
    </div>
  )
}
