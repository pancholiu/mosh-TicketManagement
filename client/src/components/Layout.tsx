import { Outlet, useNavigate, Link } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  async function handleSignOut() {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-foreground">Ticket Management</span>
            {session?.user.role === 'ADMIN' && (
              <Link to="/users" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Users
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            {session && (
              <span className="text-sm text-muted-foreground">{session.user.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
