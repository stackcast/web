import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Markets } from '@/pages/Markets'
import { MarketDetail } from '@/pages/MarketDetail'
import { Oracle } from '@/pages/Oracle'
import { WalletProvider } from '@/contexts/WalletContext'

export function App() {
  return (
    <WalletProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Markets />} />
          <Route path="market/:marketId" element={<MarketDetail />} />
          <Route path="oracle" element={<Oracle />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WalletProvider>
  )
}

export default App
