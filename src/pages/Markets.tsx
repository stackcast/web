import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useMarkets } from '@/api/queries/markets'
import { SEO } from '@/components/SEO'
import type { Market } from '@/types/api'

type StatusFilter = 'all' | 'active' | 'resolved'

const statusLabels: Record<StatusFilter, string> = {
  all: 'All markets',
  active: 'Open markets',
  resolved: 'Resolved markets'
}

const badgeVariant = (market: Market) => (market.resolved ? 'secondary' : 'default')

const formatDate = (timestamp: number) => {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString()
}

export function Markets() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: markets = [], isLoading, error, isRefetching } = useMarkets()

  const filteredMarkets = useMemo(() => {
    return (markets || []).filter((market) => {
      const matchesSearch =
        !searchTerm ||
        market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        market.marketId.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'resolved' && market.resolved) ||
        (statusFilter === 'active' && !market.resolved)
      return matchesSearch && matchesStatus
    })
  }, [markets, searchTerm, statusFilter])

  return (
    <>
      <SEO
        title="Markets"
        description="Explore active prediction markets on Bitcoin. Trade on real-world events with transparent, decentralized markets powered by Stacks blockchain."
        url="https://stackcast.xyz/"
      />
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">Markets</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Bitcoin-backed prediction markets resolved through the optimistic oracle.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Search by question or market id"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="md:max-w-sm rounded-xl h-11"
        />
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {(Object.keys(statusLabels) as StatusFilter[]).map((filterKey) => (
            <Button
              key={filterKey}
              variant={statusFilter === filterKey ? 'default' : 'outline'}
              onClick={() => setStatusFilter(filterKey)}
              className="rounded-xl font-medium text-xs sm:text-sm px-3 sm:px-4 shrink-0"
            >
              {statusLabels[filterKey]}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load markets</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isLoading ? 'Loading markets…' : `${filteredMarkets.length} markets`}
        {isRefetching && <span className="text-xs italic">Updating…</span>}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredMarkets.map((market) => (
          <Link key={market.marketId} to={`/markets/${market.marketId}`}>
            <Card className="h-full transition-all hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/50 hover:scale-[1.02] rounded-2xl border-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-tight line-clamp-3 break-words font-bold">{market.question}</CardTitle>
                  <Badge variant={badgeVariant(market)} className="shrink-0 rounded-xl px-3 py-1 font-bold">{market.resolved ? 'Resolved' : 'Active'}</Badge>
                </div>
                <CardDescription className="flex flex-col gap-1 text-xs">
                  <span className="break-all font-mono">ID: {market.marketId}</span>
                  <span>Created {formatDate(market.createdAt)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">YES</div>
                    <div className="text-2xl font-bold text-primary">
                      {(((market.yesPrice ?? 0) / 1_000_000) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">NO</div>
                    <div className="text-2xl font-bold text-primary">
                      {(((market.noPrice ?? 0) / 1_000_000) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-between pt-2 border-t border-border">
                  <span>24h volume</span>
                  <span className="font-bold text-foreground">
                    {((market.volume24h ?? 0) / 1_000_000).toFixed(2)} sBTC
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!isLoading && filteredMarkets.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No markets match</CardTitle>
            <CardDescription>Try adjusting your filters or create a new market.</CardDescription>
          </CardHeader>
        </Card>
      )}
      </div>
    </>
  )
}
