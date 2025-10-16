import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet } from '@/contexts/WalletContext'
import { CONTRACT_ADDRESSES } from '@/lib/config'
import { bufferCV, cvToValue, uintCV, principalCV } from '@stacks/transactions'
import { hexToBytes } from '@stacks/common'
import { apiRequest } from '@/api/client'
import type { Market } from '@/types/api'

interface RedeemablePosition {
  marketId: string
  question: string
  conditionId: string
  outcome: 'YES' | 'NO'
  outcomeIndex: number
  positionId: string
  balance: number
  payout: number
  payoutAmount: number
}

export function Redeem() {
  const { isConnected, userData, readContract, callContract } = useWallet()
  const address = userData?.addresses?.stx?.[0]?.address
  const [redeemablePositions, setRedeemablePositions] = useState<RedeemablePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    loadRedeemablePositions()
  }, [isConnected, address])

  const loadRedeemablePositions = async () => {
    if (!address) return

    try {
      setLoading(true)

      // Fetch all markets from the API
      const data = await apiRequest<{ success: boolean; markets: Market[] }>('/api/markets')
      const markets = data.markets || []

      // Filter for resolved markets only
      const resolvedMarkets = markets.filter(m => m.resolved)

      const [contractAddress, contractName] = CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split('.')
      const redeemable: RedeemablePosition[] = []

      for (const market of resolvedMarkets) {
        // Get condition details to check resolution
        try {
          const conditionResult = await readContract(
            contractAddress,
            contractName,
            'get-condition',
            [bufferCV(hexToBytes(market.conditionId.slice(2)))]
          )

          const condition = cvToValue(conditionResult)

          if (!condition || !condition.resolved) {
            continue
          }

          const payoutNumerators = condition['payout-numerators'] || []

          // Check YES position (outcome index 0)
          try {
            const yesBalanceResult = await readContract(
              contractAddress,
              contractName,
              'balance-of',
              [
                principalCV(address),
                bufferCV(hexToBytes(market.yesPositionId.slice(2)))
              ]
            )

            const yesBalance = cvToValue(yesBalanceResult)
            const yesBalanceNum = typeof yesBalance === 'bigint' ? Number(yesBalance) : 0

            if (yesBalanceNum > 0) {
              const yesPayout = payoutNumerators[0] || 0
              const payoutAmount = yesBalanceNum * Number(yesPayout)

              redeemable.push({
                marketId: market.marketId,
                question: market.question,
                conditionId: market.conditionId,
                outcome: 'YES',
                outcomeIndex: 0,
                positionId: market.yesPositionId,
                balance: yesBalanceNum,
                payout: Number(yesPayout),
                payoutAmount
              })
            }
          } catch (error) {
            console.error(`Error checking YES balance for ${market.marketId}:`, error)
          }

          // Check NO position (outcome index 1)
          try {
            const noBalanceResult = await readContract(
              contractAddress,
              contractName,
              'balance-of',
              [
                principalCV(address),
                bufferCV(hexToBytes(market.noPositionId.slice(2)))
              ]
            )

            const noBalance = cvToValue(noBalanceResult)
            const noBalanceNum = typeof noBalance === 'bigint' ? Number(noBalance) : 0

            if (noBalanceNum > 0) {
              const noPayout = payoutNumerators[1] || 0
              const payoutAmount = noBalanceNum * Number(noPayout)

              redeemable.push({
                marketId: market.marketId,
                question: market.question,
                conditionId: market.conditionId,
                outcome: 'NO',
                outcomeIndex: 1,
                positionId: market.noPositionId,
                balance: noBalanceNum,
                payout: Number(noPayout),
                payoutAmount
              })
            }
          } catch (error) {
            console.error(`Error checking NO balance for ${market.marketId}:`, error)
          }
        } catch (error) {
          console.error(`Error fetching condition for ${market.marketId}:`, error)
        }
      }

      setRedeemablePositions(redeemable)
    } catch (error) {
      console.error('Error loading redeemable positions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async (position: RedeemablePosition) => {
    if (!address) return

    setRedeeming(position.positionId)

    try {
      const [contractAddress, contractName] = CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split('.')

      const response = await callContract(
        contractAddress,
        contractName,
        'redeem-positions',
        [
          bufferCV(hexToBytes(position.conditionId.slice(2))),
          uintCV(position.outcomeIndex)
        ]
      )

      console.log('Redemption successful:', response)
      alert(`✅ Redemption successful!\n\nYou received ${position.payoutAmount} sBTC\nTransaction ID: ${response.txid}`)

      // Reload positions after a delay
      setTimeout(() => {
        loadRedeemablePositions()
      }, 2000)
    } catch (error) {
      console.error('Redemption error:', error)
      alert('Redemption failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setRedeeming(null)
    }
  }

  const totalRedeemable = redeemablePositions.reduce((sum, p) => sum + p.payoutAmount, 0)
  const winningPositions = redeemablePositions.filter(p => p.payout > 0)
  const losingPositions = redeemablePositions.filter(p => p.payout === 0)

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Redeem Winnings</h1>
          <p className="text-muted-foreground mt-2">Claim your payouts from resolved markets</p>
        </div>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Connect your wallet to redeem your winnings
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
          <h1 className="text-4xl font-bold">Redeem Winnings</h1>
          <p className="text-muted-foreground mt-2">
            Claim payouts from resolved markets
          </p>
        </div>
        <Button onClick={loadRedeemablePositions} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Total Redeemable
            </CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-400">
              {totalRedeemable.toFixed(4)} sBTC
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Winning Positions
            </CardDescription>
            <CardTitle className="text-3xl">{winningPositions.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="uppercase text-xs tracking-wide">
              Losing Positions
            </CardDescription>
            <CardTitle className="text-3xl">{losingPositions.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {winningPositions.length > 0 && (
        <Card className="border-green-500/50">
          <CardHeader>
            <CardTitle>💰 Winning Positions - Claim Your Rewards!</CardTitle>
            <CardDescription>
              These positions are worth sBTC. Click "Redeem" to claim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Payout Amount</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {winningPositions.map((position) => (
                  <TableRow key={`${position.marketId}-${position.outcome}`}>
                    <TableCell className="max-w-xs">
                      <div className="truncate font-medium">{position.question}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {position.marketId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-600">
                        {position.outcome} ✓
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {position.balance} tokens
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {position.payoutAmount.toFixed(4)} sBTC
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleRedeem(position)}
                        disabled={redeeming !== null}
                      >
                        {redeeming === position.positionId ? 'Redeeming...' : 'Redeem'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {losingPositions.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader>
            <CardTitle>❌ Losing Positions</CardTitle>
            <CardDescription>
              These positions have no value. You can still redeem them to clear your balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {losingPositions.map((position) => (
                  <TableRow key={`${position.marketId}-${position.outcome}`}>
                    <TableCell className="max-w-xs">
                      <div className="truncate">{position.question}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {position.marketId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {position.outcome} ✗
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {position.balance} tokens
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      0 sBTC
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRedeem(position)}
                        disabled={redeeming !== null}
                      >
                        {redeeming === position.positionId ? 'Clearing...' : 'Clear'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading redeemable positions...
          </CardContent>
        </Card>
      )}

      {!loading && redeemablePositions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              You don't have any positions to redeem
            </p>
            <Link to="/">
              <Button>Browse Markets</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
