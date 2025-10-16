import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWallet } from '@/contexts/WalletContext'

export function Layout() {
  const location = useLocation()
  const { isConnected, connectWallet, disconnectWallet, userData, isLoading, error } = useWallet()

  const isActive = (path: string) => location.pathname === path

  const getShortAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getStxAddress = () => {
    return userData?.addresses?.stx?.[0]?.address
  }

  const handleWalletAction = () => {
    if (isConnected) {
      disconnectWallet()
    } else {
      connectWallet()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b backdrop-blur-sm bg-background/95 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-3 group transition-all">
              <img src="/logo.png" alt="StackCast Logo" className="h-9 w-9 transition-transform group-hover:scale-110" />
              <span className="text-2xl font-bold tracking-tight" style={{ color: '#F69502' }}>StackCast</span>
            </Link>
            <div className="flex gap-2">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                asChild
                className="rounded-xl font-medium transition-all"
              >
                <Link to="/">Markets</Link>
              </Button>
              <Button
                variant={isActive('/portfolio') ? 'default' : 'ghost'}
                asChild
                className="rounded-xl font-medium transition-all"
              >
                <Link to="/portfolio">Portfolio</Link>
              </Button>
              <Button
                variant={isActive('/redeem') ? 'default' : 'ghost'}
                asChild
                className="rounded-xl font-medium transition-all"
              >
                <Link to="/redeem">Redeem</Link>
              </Button>
              <Button
                variant={isActive('/oracle') ? 'default' : 'ghost'}
                asChild
                className="rounded-xl font-medium transition-all"
              >
                <Link to="/oracle">Oracle</Link>
              </Button>
              <Button
                variant={isActive('/voting') ? 'default' : 'ghost'}
                asChild
                className="rounded-xl font-medium transition-all"
              >
                <Link to="/voting">Voting</Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && getStxAddress() && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono px-3 py-1.5 rounded-lg">
                  {getShortAddress(getStxAddress()!)}
                </Badge>
              </div>
            )}
            <Button
              onClick={handleWalletAction}
              disabled={isLoading}
              variant={isConnected ? "outline" : "default"}
              className="rounded-xl font-medium px-6 transition-all"
            >
              {isLoading ? "Connecting..." : isConnected ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="container mx-auto px-6 pb-3">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-destructive text-sm font-medium">Wallet Error: {error}</p>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
