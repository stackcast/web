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
          
          <div className="flex items-center gap-3">
            {isConnected && getStxAddress() && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getShortAddress(getStxAddress()!)}
                </Badge>
              </div>
            )}
            <Button 
              onClick={handleWalletAction}
              disabled={isLoading}
              variant={isConnected ? "outline" : "default"}
              className={isConnected ? "" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isLoading ? "Connecting..." : isConnected ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="container mx-auto px-4 pb-2">
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">Wallet Error: {error}</p>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
