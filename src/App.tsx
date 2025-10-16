import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { Markets } from '@/pages/Markets'
import { MarketDetail } from '@/pages/MarketDetail'
import { Oracle } from '@/pages/Oracle'
import { Voting } from '@/pages/Voting'
import { Portfolio } from '@/pages/Portfolio'
import { Redeem } from '@/pages/Redeem'
import { WalletProvider } from '@/contexts/WalletContext'
import { useEffect } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
})

export function App() {
  // Enable dark mode by default for StackCast brand
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Markets />} />
              <Route path="markets/:marketId" element={<MarketDetail />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="redeem" element={<Redeem />} />
              <Route path="oracle" element={<Oracle />} />
              <Route path="voting" element={<Voting />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </WalletProvider>
      </QueryClientProvider>
    </HelmetProvider>
  )
}

export default App
