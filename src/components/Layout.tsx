import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/WalletContext";

export function Layout() {
  const location = useLocation();
  const {
    isConnected,
    connectWallet,
    disconnectWallet,
    userData,
    isLoading,
    error,
  } = useWallet();

  const isActive = (path: string) => location.pathname === path;

  const getShortAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStxAddress = () => {
    return userData?.addresses?.find(addr => addr.symbol === 'STX')?.address;
  };

  const handleWalletAction = () => {
    if (isConnected) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card">
      <nav className="border-b border-border backdrop-blur-sm bg-background/95 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 sm:gap-3 group transition-all shrink-0"
            >
              <img
                src="/logo.png"
                alt="StackCast Logo"
                className="h-7 w-7 sm:h-9 sm:w-9 transition-transform group-hover:scale-110"
              />
              <span className="text-lg sm:text-2xl font-bold text-primary tracking-tight">
                StackCast
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {isConnected && getStxAddress() && (
                <Badge
                  variant="outline"
                  className="hidden sm:flex text-xs font-mono px-3 py-1.5 rounded-lg border-primary/20 bg-primary/5 text-foreground"
                >
                  {getShortAddress(getStxAddress()!)}
                </Badge>
              )}
              <Button
                onClick={handleWalletAction}
                disabled={isLoading}
                variant={isConnected ? "outline" : "default"}
                className="rounded-xl font-bold px-3 sm:px-6 text-sm sm:text-base transition-all hover:bg-primary/90 shrink-0"
              >
                {isLoading
                  ? "..."
                  : isConnected
                  ? "Disconnect"
                  : "Connect"}
              </Button>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              asChild
              className="rounded-xl font-medium transition-all hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              <Link to="/">Markets</Link>
            </Button>
            <Button
              variant={isActive("/portfolio") ? "default" : "ghost"}
              asChild
              className="rounded-xl font-medium transition-all hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              <Link to="/portfolio">Portfolio</Link>
            </Button>
            <Button
              variant={isActive("/redeem") ? "default" : "ghost"}
              asChild
              className="rounded-xl font-medium transition-all hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              <Link to="/redeem">Redeem</Link>
            </Button>
            <Button
              variant={isActive("/oracle") ? "default" : "ghost"}
              asChild
              className="rounded-xl font-medium transition-all hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              <Link to="/oracle">Oracle</Link>
            </Button>
            <Button
              variant={isActive("/voting") ? "default" : "ghost"}
              asChild
              className="rounded-xl font-medium transition-all hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              <Link to="/voting">Voting</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="container mx-auto px-4 sm:px-8 pb-3">
            <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-2xl">
              <p className="text-destructive text-sm font-bold">
                Wallet Error: {error}
              </p>
            </div>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
