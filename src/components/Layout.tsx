import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function Layout() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-bold">
              StackCast
            </Link>
            <div className="flex gap-4">
              <Button variant={isActive('/') ? 'default' : 'ghost'} asChild>
                <Link to="/">Markets</Link>
              </Button>
              <Button variant={isActive('/oracle') ? 'default' : 'ghost'} asChild>
                <Link to="/oracle">Oracle</Link>
              </Button>
            </div>
          </div>
          <Button>Connect Wallet</Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
