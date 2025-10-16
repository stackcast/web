import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet } from '@/contexts/WalletContext'
import { CONTRACT_ADDRESSES } from '@/lib/config'
import { bufferCV, cvToValue, principalCV } from '@stacks/transactions'
import { hexToBytes } from '@stacks/common'
import { apiRequest } from '@/api/client'
import type { Market } from '@/types/api'

interface PositionBalance {
  marketId: string
  question: string
  conditionId: string
  outcome: 'YES' | 'NO'
  positionId: string
  balance: number
  currentPrice: number
  value: number
}

export function Portfolio() {
  const { isConnected, userData, readContract } = useWallet()
  const address = userData?.addresses?.stx?.[0]?.address
  const [positions, setPositions] = useState<PositionBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    loadPositions()
  }, [isConnected, address])

  const loadPositions = async () => {
    if (!address) return

    try {
      setLoading(true)

      // Fetch all markets from the API
      const data = await apiRequest<{ success: boolean; markets: Market[] }>('/api/markets')
      const markets = data.markets || []

      const [contractAddress, contractName] = CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split('.')
      const positionBalances: PositionBalance[] = []

      // Check balance for each market's YES and NO positions
      for (const market of markets) {
        // Check YES balance
        try {
          const yesResult = await readContract(
            contractAddress,
            contractName,
            'balance-of',
            [
              principalCV(address),
              bufferCV(hexToBytes(market.yesPositionId.slice(2)))
            ]
          )

          const yesBalance = cvToValue(yesResult)
          const yesBalanceNum = typeof yesBalance === 'bigint' ? Number(yesBalance) : 0

          if (yesBalanceNum > 0) {
            positionBalances.push({
              marketId: market.marketId,
              question: market.question,
              conditionId: market.conditionId,
              outcome: 'YES',
              positionId: market.yesPositionId,
              balance: yesBalanceNum,
              currentPrice: market.yesPrice || 0,
              value: (yesBalanceNum * (market.yesPrice || 0)) / 100
            })
          }
        } catch (error) {
          console.error(`Error fetching YES balance for ${market.marketId}:`, error)
        }

        // Check NO balance
        try {
          const noResult = await readContract(
            contractAddress,
            contractName,
            'balance-of',
            [
              principalCV(address),
              bufferCV(hexToBytes(market.noPositionId.slice(2)))
            ]
          )

          const noBalance = cvToValue(noResult)
          const noBalanceNum = typeof noBalance === 'bigint' ? Number(noBalance) : 0

          if (noBalanceNum > 0) {
            positionBalances.push({
              marketId: market.marketId,
              question: market.question,
              conditionId: market.conditionId,
              outcome: 'NO',
              positionId: market.noPositionId,
              balance: noBalanceNum,
              currentPrice: market.noPrice || 0,
              value: (noBalanceNum * (market.noPrice || 0)) / 100
            })
          }
        } catch (error) {
          console.error(`Error fetching NO balance for ${market.marketId}:`, error)
        }
      }

      setPositions(positionBalances)
      setTotalValue(positionBalances.reduce((sum, p) => sum + p.value, 0))
    } catch (error) {
      console.error('Error loading positions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground mt-2">View your position tokens across all markets</p>
        </div>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Connect your wallet to view your portfolio
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground mt-2">
            Your position tokens across all markets
          </p>
        </div>
        <Button onClick={loadPositions} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Total Positions
            </CardDescription>
            <CardTitle className="text-3xl">{positions.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Estimated Value
            </CardDescription>
            <CardTitle className="text-3xl">
              {totalValue.toFixed(2)} sBTC
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Unique Markets
            </CardDescription>
            <CardTitle className="text-3xl">
              {new Set(positions.map(p => p.marketId)).size}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
          <CardDescription>
            All YES and NO tokens you currently hold
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading positions...
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                You don't have any position tokens yet
              </p>
              <Link to="/">
                <Button>Browse Markets</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position, index) => (
                  <TableRow key={`${position.marketId}-${position.outcome}-${index}`}>
                    <TableCell className="max-w-xs">
                      <div className="truncate">{position.question}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {position.marketId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={position.outcome === 'YES' ? 'default' : 'secondary'}>
                        {position.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {position.balance}
                    </TableCell>
                    <TableCell className="text-right">
                      {position.currentPrice.toFixed(2)}¢
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {position.value.toFixed(4)} sBTC
                    </TableCell>
                    <TableCell>
                      <Link to={`/markets/${position.marketId}`}>
                        <Button size="sm" variant="outline">
                          Trade
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
