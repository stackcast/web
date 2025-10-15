import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Markets } from '@/pages/Markets'
import { MarketDetail } from '@/pages/MarketDetail'
import { Oracle } from '@/pages/Oracle'
import { Voting } from '@/pages/Voting'
import { WalletProvider } from '@/contexts/WalletContext'

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
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Markets />} />
            <Route path="market/:marketId" element={<MarketDetail />} />
            <Route path="oracle" element={<Oracle />} />
            <Route path="voting" element={<Voting />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WalletProvider>
    </QueryClientProvider>
  )
}

export default App
