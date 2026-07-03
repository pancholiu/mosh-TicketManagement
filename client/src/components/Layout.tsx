import { Outlet, useNavigate, Link } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { TextLink } from '@/components/ui/link'

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
            <Link to="/" className="font-semibold text-foreground">Ticket Management</Link>
            <TextLink to="/tickets">Tickets</TextLink>
            {session?.user.role === 'ADMIN' && <TextLink to="/users">Users</TextLink>}
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
