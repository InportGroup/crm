import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ThemeProvider } from './context/ThemeProvider'
import { FeedbackProvider } from './context/FeedbackProvider'
import { useAuth } from './context/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { Layout } from './components/Layout'
import { SetupNotice } from './components/SetupNotice'
import { Spinner } from './components/ui'
import { Login, UpdatePassword } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Contacts } from './pages/Contacts'
import { Companies } from './pages/Companies'
import { Deals } from './pages/Deals'
import { Tasks } from './pages/Tasks'
import { Expenses } from './pages/Expenses'
import { Vault } from './pages/Vault'

export default function App() {
  // Fail loud but friendly rather than constructing a client against nothing.
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupNotice />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AuthProvider>
          {/* HashRouter keeps deep links working on GitHub Pages, which has no
              server-side rewrite to fall back on for /contacts style paths. */}
          <HashRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/vault" element={<Vault />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}

function RequireAuth() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Spinner label="Checking your session…" />
  // A recovery session is a real session, so this check must come first or the
  // user lands in the CRM without ever setting the new password.
  if (recovery) return <UpdatePassword />
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

function PublicOnly() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Spinner label="Checking your session…" />
  if (recovery) return <UpdatePassword />
  if (session) return <Navigate to="/" replace />
  return <Login />
}
