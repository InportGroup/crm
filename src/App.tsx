import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { Layout } from './components/Layout'
import { SetupNotice } from './components/SetupNotice'
import { Spinner } from './components/ui'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Contacts } from './pages/Contacts'
import { Companies } from './pages/Companies'
import { Deals } from './pages/Deals'
import { Tasks } from './pages/Tasks'

export default function App() {
  // Fail loud but friendly rather than constructing a client against nothing.
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner label="Checking your session…" />
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner label="Checking your session…" />
  if (session) return <Navigate to="/" replace />
  return <Login />
}
