import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { authClient } from './lib/auth-client'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

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
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Ticket Management</h1>
        <p className="text-gray-500">
          API status:{' '}
          <span
            className={
              status === 'ok'
                ? 'text-green-600 font-medium'
                : status === 'error'
                  ? 'text-red-600 font-medium'
                  : 'text-gray-400'
            }
          >
            {status ?? 'checking…'}
          </span>
        </p>
      </div>
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
      </Route>
    </Routes>
  )
}

export default App
