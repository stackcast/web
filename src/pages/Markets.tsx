import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'
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
  const [creator, setCreator] = useState('')
  const [question, setQuestion] = useState('')
  const [conditionId, setConditionId] = useState('')

  const queryClient = useQueryClient()

  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: ['markets'],
    queryFn: () => api.getMarkets(new AbortController().signal),
    refetchInterval: 5000,
  })

  const createMarketMutation = useMutation({
    mutationFn: (params: { question: string; creator: string; conditionId?: string }) =>
      api.createMarket(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      setQuestion('')
      setCreator('')
      setConditionId('')
    },
  })

  const markets = useMemo(() => data?.markets ?? [], [data?.markets])

  const filteredMarkets = useMemo(() => {
    return markets.filter((market) => {
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

  const handleCreateMarket = async (event: FormEvent) => {
    event.preventDefault()
    if (!question || !creator) return
    createMarketMutation.mutate({ question, creator, conditionId: conditionId || undefined })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Markets</h1>
          <p className="text-muted-foreground">
            Bitcoin-backed prediction markets resolved through the optimistic oracle.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg">Create market</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new market</DialogTitle>
              <DialogDescription>Submit a new yes/no condition to the matching engine.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4 pt-4" onSubmit={handleCreateMarket}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Question</label>
                <Input
                  placeholder="Will BTC close above $100k on Dec 31?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Creator principal</label>
                <Input
                  placeholder="ST..."
                  value={creator}
                  onChange={(event) => setCreator(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Condition ID (optional)</label>
                <Input
                  placeholder="market_btc_2025"
                  value={conditionId}
                  onChange={(event) => setConditionId(event.target.value)}
                />
              </div>
              <Button className="w-full" type="submit" disabled={createMarketMutation.isPending}>
                {createMarketMutation.isPending ? 'Creating…' : 'Create market'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Search by question or market id"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="md:max-w-sm"
        />
        <div className="flex gap-2">
          {(Object.keys(statusLabels) as StatusFilter[]).map((filterKey) => (
            <Button
              key={filterKey}
              variant={statusFilter === filterKey ? 'default' : 'outline'}
              onClick={() => setStatusFilter(filterKey)}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredMarkets.map((market) => (
          <Link key={market.marketId} to={`/market/${market.marketId}`}>
            <Card className="h-full transition hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-tight line-clamp-3">{market.question}</CardTitle>
                  <Badge variant={badgeVariant(market)}>{market.resolved ? 'Resolved' : 'Active'}</Badge>
                </div>
                <CardDescription className="flex flex-col gap-1 text-xs">
                  <span>ID: {market.marketId}</span>
                  <span>Created {formatDate(market.createdAt)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">YES</div>
                    <div className="text-2xl font-semibold">{market.yesPrice?.toFixed(2)}¢</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-muted-foreground">NO</div>
                    <div className="text-2xl font-semibold">{market.noPrice?.toFixed(2)}¢</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  24h volume
                  <span className="font-medium text-foreground ml-2">{market.volume24h?.toFixed(2)} sBTC</span>
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
  )
}
