import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'

function App() {
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Ticket Management
              </h1>
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
        }
      />
    </Routes>
  )
}

export default App
