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
      <nav className="bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground">
              <span className="size-2 rounded-[2px] bg-foreground" aria-hidden />
              TicketDesk
            </Link>
            <div className="flex items-center gap-5">
              <TextLink
                to="/tickets"
                className="font-mono text-xs uppercase tracking-wider"
              >
                Tickets
              </TextLink>
              {session?.user.role === 'ADMIN' && (
                <TextLink
                  to="/users"
                  className="font-mono text-xs uppercase tracking-wider"
                >
                  Users
                </TextLink>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {session && (
              <span className="font-mono text-xs text-muted-foreground">{session.user.name}</span>
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
