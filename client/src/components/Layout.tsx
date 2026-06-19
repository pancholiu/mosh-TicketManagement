import { Outlet, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

export default function Layout() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  async function handleSignOut() {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="font-semibold text-gray-900">Ticket Management</span>

          <div className="flex items-center gap-4">
            {session && (
              <span className="text-sm text-gray-600">{session.user.name}</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
