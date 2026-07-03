import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { authClient } from './lib/auth-client'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import UsersPage from './pages/UsersPage'
import { Card, CardContent } from '@/components/ui/card'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (session.user.role !== 'ADMIN') return <Navigate to="/" replace />

  return <>{children}</>
}

function HomePage() {
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="flex items-center justify-center py-20">
      <Card className="text-center">
        <CardContent className="pt-6 space-y-2">
          <h1 className="text-3xl font-bold">Ticket Management</h1>
          <p className="text-muted-foreground">
            API status:{' '}
            <span
              className={
                status === 'ok'
                  ? 'text-green-600 font-medium'
                  : status === 'error'
                    ? 'text-destructive font-medium'
                    : 'text-muted-foreground'
              }
            >
              {status ?? 'checking…'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
