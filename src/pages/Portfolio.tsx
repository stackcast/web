import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet } from '@/contexts/WalletContext'
import { CONTRACT_ADDRESSES } from '@/lib/config'
import { bufferCV, cvToValue, principalCV, uintCV } from '@stacks/transactions'
import { hexToBytes } from '@stacks/common'
import { apiRequest } from '@/api/client'
import type { Market } from '@/types/api'
import { checkMergeablePairs, waitForTransactionConfirmation } from '@/utils/stacksHelpers'
import { Wallet } from 'lucide-react'

interface PositionBalance {
  marketId: string
  question: string
  conditionId: string
  outcome: 'YES' | 'NO'
  positionId: string
  balance: number
  currentPrice: number
  value: number
  yesPositionId?: string
  noPositionId?: string
}

interface MergeableMarket {
  marketId: string
  question: string
  conditionId: string
  yesPositionId: string
  noPositionId: string
  mergeableAmount: number
  yesBalance: number
  noBalance: number
}

export function Portfolio() {
  const { isConnected, userData, readContract, callContract } = useWallet()
  const address = userData?.addresses?.find(addr => addr.symbol === 'STX')?.address
  const [positions, setPositions] = useState<PositionBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)
  const [mergeableMarkets, setMergeableMarkets] = useState<MergeableMarket[]>([])
  const [merging, setMerging] = useState(false)
  const [mergeMessage, setMergeMessage] = useState<string>()

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
      const mergeable: MergeableMarket[] = []

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

      // Check for mergeable pairs across all markets
      for (const market of markets) {
        try {
          const { mergeableAmount, yesBalance, noBalance } = await checkMergeablePairs({
            userAddress: address,
            yesPositionId: market.yesPositionId,
            noPositionId: market.noPositionId,
          })

          if (mergeableAmount > 0) {
            mergeable.push({
              marketId: market.marketId,
              question: market.question,
              conditionId: market.conditionId,
              yesPositionId: market.yesPositionId,
              noPositionId: market.noPositionId,
              mergeableAmount: Number(mergeableAmount) / 1_000_000,
              yesBalance: Number(yesBalance) / 1_000_000,
              noBalance: Number(noBalance) / 1_000_000,
            })
          }
        } catch (error) {
          console.error(`Error checking mergeable pairs for ${market.marketId}:`, error)
        }
      }

      setMergeableMarkets(mergeable)
    } catch (error) {
      console.error('Error loading positions:', error)
    } finally {
      setLoading(false)
    }
  }

  const mergeMarketPairs = async (market: MergeableMarket) => {
    if (!address) return

    try {
      setMerging(true)
      setMergeMessage(`Merging ${market.mergeableAmount.toFixed(4)} pairs for ${market.question.slice(0, 50)}...`)

      const [contractAddress, contractName] = CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split('.')
      const amountMicroSats = Math.floor(market.mergeableAmount * 1_000_000)

      const response = await callContract(
        contractAddress,
        contractName,
        'merge-positions',
        [
          uintCV(amountMicroSats),
          bufferCV(hexToBytes(market.conditionId.replace('0x', ''))),
          principalCV(address),
        ]
      )

      setMergeMessage(`⏳ Waiting for confirmation (${response.txid.slice(0, 8)}...)...`)

      try {
        const confirmation = await waitForTransactionConfirmation(response.txid)

        if (confirmation.success) {
          setMergeMessage(`✅ Merged ${market.mergeableAmount.toFixed(4)} sBTC successfully!`)
          setTimeout(() => {
            loadPositions()
            setMergeMessage(undefined)
          }, 2000)
        } else {
          setMergeMessage(`❌ Merge failed: ${confirmation.status}`)
        }
      } catch (error) {
        setMergeMessage('⏱️ Transaction timeout - please check blockchain')
      }
    } catch (error) {
      console.error('Merge error:', error)
      setMergeMessage('Merge cancelled or failed')
      setTimeout(() => setMergeMessage(undefined), 2000)
    } finally {
      setMerging(false)
    }
  }

  const mergeAllMarkets = async () => {
    if (mergeableMarkets.length === 0) return

    const totalMergeable = mergeableMarkets.reduce((sum, m) => sum + m.mergeableAmount, 0)

    const confirmed = window.confirm(
      `Merge all pairs across ${mergeableMarkets.length} markets?\n\n` +
      `Total: ${totalMergeable.toFixed(4)} sBTC\n\n` +
      mergeableMarkets.map(m =>
        `• ${m.question.slice(0, 40)}...: ${m.mergeableAmount.toFixed(4)} sBTC`
      ).join('\n')
    )

    if (!confirmed) return

    for (const market of mergeableMarkets) {
      await mergeMarketPairs(market)
      // Small delay between merges
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-lg">View your position tokens across all markets</p>
        </div>
        <Card className="border-2 border-primary rounded-2xl bg-primary shadow-2xl shadow-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-black font-bold">
              Connect your wallet to view your portfolio
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">Portfolio</h1>
          <p className="text-muted-foreground text-lg">
            Your position tokens across all markets
          </p>
        </div>
        <Button onClick={loadPositions} disabled={loading} className="rounded-xl font-bold px-6">
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

      {mergeableMarkets.length > 0 && (
        <Card className="border-2 border-primary rounded-2xl bg-primary shadow-2xl shadow-primary/20 p-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-black flex items-center gap-2">
                  <div className="bg-black/20 rounded-xl p-2">
                    <Wallet className="h-8 w-8 text-black" />
                  </div>
                  Withdraw to sBTC
                </CardTitle>
                <CardDescription className="text-base text-black/80 font-medium">
                  You have {mergeableMarkets.reduce((sum, m) => sum + m.mergeableAmount, 0).toFixed(4)} sBTC
                  in mergeable pairs across {mergeableMarkets.length} markets
                </CardDescription>
              </div>
              <Button
                onClick={mergeAllMarkets}
                disabled={merging}
                variant="default"
                className="rounded-xl font-bold px-8 bg-black/10 hover:bg-black/20 text-black border-2 border-black/20"
              >
                {merging ? 'Merging...' : 'Merge All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {mergeMessage && (
              <div className="mb-4 p-3 rounded bg-muted text-sm">
                {mergeMessage}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">YES Balance</TableHead>
                  <TableHead className="text-right">NO Balance</TableHead>
                  <TableHead className="text-right">Mergeable</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergeableMarkets.map((market) => (
                  <TableRow key={market.marketId}>
                    <TableCell className="max-w-xs">
                      <div className="truncate">{market.question}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {market.marketId}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {market.yesBalance.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {market.noBalance.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {market.mergeableAmount.toFixed(4)} sBTC
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mergeMarketPairs(market)}
                        disabled={merging}
                      >
                        Merge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
