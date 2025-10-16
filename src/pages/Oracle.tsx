import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMarkets, useMarketStats } from '@/api/queries/markets'
import { useTrades } from '@/api/queries/orderbook'
import type { Trade } from '@/types/api'

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString()

export function Oracle() {
  const { data: markets = [], isLoading: marketsLoading } = useMarkets()

  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [evidenceUrl, setEvidenceUrl] = useState<string>('')
  const [resolutionNote, setResolutionNote] = useState<string>('')

  const selectedMarket =
    markets.find((market) => market.marketId === selectedMarketId) || markets[0] || undefined

  const { data: stats } = useMarketStats(selectedMarket?.marketId || '')
  const { data: trades = [] } = useTrades(selectedMarket?.marketId || '', 8)

  const activeMarkets = useMemo(() => markets.filter((market) => !market.resolved), [markets])
  const resolvedMarkets = useMemo(() => markets.filter((market) => market.resolved), [markets])

  const handleSelectMarket = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMarketId(event.target.value)
    setEvidenceUrl('')
    setResolutionNote('')
  }

  const handlePrepareResolution = () => {
    if (!selectedMarket) return ''
    return JSON.stringify(
      {
        marketId: selectedMarket.marketId,
        conditionId: selectedMarket.conditionId,
        proposedOutcome: outcomeFromPrice(selectedMarket.yesPrice),
        evidenceUrl: evidenceUrl || undefined,
        note: resolutionNote || undefined
      },
      null,
      2
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-5xl font-bold tracking-tight">Oracle Console</h1>
        <p className="text-muted-foreground text-lg">
          Monitor market queues, prepare optimistic oracle resolutions, and track recent settlements directly
          from the live matching engine APIs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InsightCard label="Active markets" value={activeMarkets.length} isLoading={marketsLoading} />
        <InsightCard label="Resolved markets" value={resolvedMarkets.length} isLoading={marketsLoading} />
        <InsightCard
          label="Selected YES price"
          value={selectedMarket ? `${selectedMarket.yesPrice.toFixed(2)}¢` : '—'}
          isLoading={marketsLoading}
        />
        <InsightCard
          label="Selected NO price"
          value={selectedMarket ? `${selectedMarket.noPrice.toFixed(2)}¢` : '—'}
          isLoading={marketsLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oracle queue</CardTitle>
          <CardDescription>Live markets derived from the API. Click any row to review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {marketsLoading
                ? 'Loading markets…'
                : `${activeMarkets.length} active • ${resolvedMarkets.length} resolved`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Select market</span>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedMarket?.marketId ?? ''}
                onChange={handleSelectMarket}
              >
                {markets.map((market) => (
                  <option key={market.marketId} value={market.marketId}>
                    {market.marketId} – {market.question.slice(0, 40)}
                    {market.question.length > 40 ? '…' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>YES</TableHead>
                <TableHead>NO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((market) => (
                <TableRow
                  key={market.marketId}
                  className={market.marketId === selectedMarket?.marketId ? 'bg-muted/50' : undefined}
                >
                  <TableCell className="text-xs font-mono">{market.marketId}</TableCell>
                  <TableCell className="text-sm">{market.question}</TableCell>
                  <TableCell>
                    <Badge variant={market.resolved ? 'secondary' : 'default'}>
                      {market.resolved ? 'Resolved' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>{market.yesPrice.toFixed(2)}¢</TableCell>
                  <TableCell>{market.noPrice.toFixed(2)}¢</TableCell>
                </TableRow>
              ))}
              {!markets.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No markets found. Use the markets page to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resolution workspace</CardTitle>
            <CardDescription>Prepare inputs for on-chain optimistic oracle calls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Evidence URL</label>
              <Input
                placeholder="https://example.com/proof"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Resolution note</label>
              <Input
                placeholder="Source + logic behind the proposed resolution"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
              />
            </div>
            <div className="space-y-2 rounded-md border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payload preview</div>
              <pre className="whitespace-pre-wrap break-words text-xs">
                {selectedMarket ? handlePrepareResolution() : 'Select a market to build payload'}
              </pre>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                const payload = handlePrepareResolution()
                if (payload) navigator.clipboard?.writeText(payload).catch(() => undefined)
              }}
              disabled={!selectedMarket}
            >
              Copy payload JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution helpers</CardTitle>
            <CardDescription>
              Ready-to-run commands that call the smart contracts via Clarinet or the backend Oracle adapter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HelperCommand
              label="Propose outcome (optimistic oracle)"
              command={
                selectedMarket
                  ? `clarinet contract-call stackcast-contracts optimistic-oracle propose-outcome ${selectedMarket.marketId} ${outcomeFromPrice(selectedMarket.yesPrice)}`
                  : 'Select a market first'
              }
            />
            <HelperCommand
              label="Challenge proposal"
              command={
                selectedMarket
                  ? `clarinet contract-call stackcast-contracts optimistic-oracle challenge ${selectedMarket.marketId} <evidence-url>`
                  : 'Select a market first'
              }
            />
            <HelperCommand
              label="Finalize payout (merge positions)"
              command={
                selectedMarket
                  ? `clarinet contract-call stackcast-contracts conditional-tokens merge-positions ${selectedMarket.conditionId} ${outcomeFromPrice(selectedMarket.yesPrice)}`
                  : 'Select a market first'
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification feed</CardTitle>
          <CardDescription>Stats and trades for the selected market (auto-refreshing).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total orders" value={stats?.totalOrders} />
            <Metric label="Open orders" value={stats?.openOrders} />
            <Metric label="Total trades" value={stats?.totalTrades} />
            <Metric label="Last price" value={stats?.lastPrice?.toFixed(2)} suffix="¢" />
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent trades</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Price</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length ? (
                  trades.map((trade: Trade) => (
                    <TableRow key={trade.tradeId}>
                      <TableCell>{trade.price.toFixed(2)}¢</TableCell>
                      <TableCell>{trade.size}</TableCell>
                      <TableCell>{trade.side}</TableCell>
                      <TableCell>{formatDate(trade.timestamp)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No trades recorded for this market yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function outcomeFromPrice(yesPrice: number) {
  return yesPrice >= 50 ? 'yes' : 'no'
}

interface InsightCardProps {
  label: string
  value: string | number
  isLoading?: boolean
}

function InsightCard({ label, value, isLoading }: InsightCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardDescription className="uppercase text-xs tracking-wide">{label}</CardDescription>
        <CardTitle className="text-2xl">{isLoading ? '…' : value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

interface HelperCommandProps {
  label: string
  command: string
}

function HelperCommand({ label, command }: HelperCommandProps) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <code className="block whitespace-pre-wrap text-xs font-mono">{command}</code>
    </div>
  )
}

interface MetricProps {
  label: string
  value?: string | number
  suffix?: string
}

function Metric({ label, value, suffix }: MetricProps) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">
        {typeof value === 'undefined' ? '—' : `${value}${suffix ?? ''}`}
      </div>
    </div>
  )
}
