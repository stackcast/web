import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { usePriceHistory } from '@/api/queries/markets';

interface PriceChartProps {
  marketId: string;
  currentYesPrice: number;
  currentNoPrice: number;
}

export function PriceChart({ marketId, currentYesPrice, currentNoPrice }: PriceChartProps) {
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [interval, setInterval] = useState<'5m' | '15m' | '1h' | '4h' | '1d'>('1h');

  const { data, isLoading } = usePriceHistory(marketId, interval);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data?.priceHistory) return [];

    return data.priceHistory.map((point) => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      timestamp: point.timestamp,
      price: outcome === 'yes' ? point.yes.close / 1_000_000 : point.no.close / 1_000_000,
      high: outcome === 'yes' ? point.yes.high / 1_000_000 : point.no.high / 1_000_000,
      low: outcome === 'yes' ? point.yes.low / 1_000_000 : point.no.low / 1_000_000,
      volume: outcome === 'yes' ? point.yes.volume : point.no.volume,
    }));
  }, [data?.priceHistory, outcome]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percentage: 0 };

    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    const change = lastPrice - firstPrice;
    const percentage = (change / firstPrice) * 100;

    return { value: change, percentage };
  }, [chartData]);

  const currentPrice = outcome === 'yes' ? currentYesPrice / 1_000_000 : currentNoPrice / 1_000_000;
  const isPositive = priceChange.value >= 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Chart</CardTitle>
          <CardDescription>Loading price history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.priceHistory || data.priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Chart</CardTitle>
          <CardDescription>No trading history available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center border border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground">
              Price chart will appear after the first trade
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              Price Chart
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={outcome === 'yes' ? 'default' : 'outline'}
                  onClick={() => setOutcome('yes')}
                  className="rounded-lg h-8"
                >
                  YES
                </Button>
                <Button
                  size="sm"
                  variant={outcome === 'no' ? 'default' : 'outline'}
                  onClick={() => setOutcome('no')}
                  className="rounded-lg h-8"
                >
                  NO
                </Button>
              </div>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-bold text-foreground">
                {currentPrice.toFixed(2)} sBTC
              </span>
              <span
                className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isPositive ? '+' : ''}
                {priceChange.value.toFixed(3)} ({priceChange.percentage.toFixed(2)}%)
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {(['5m', '15m', '1h', '4h', '1d'] as const).map((int) => (
              <Button
                key={int}
                size="sm"
                variant={interval === int ? 'default' : 'ghost'}
                onClick={() => setInterval(int)}
                className="rounded-lg h-8 px-3 text-xs"
              >
                {int}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F69502" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F69502" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis
              dataKey="time"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(2)}`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(4)} sBTC`,
                name === 'price' ? 'Price' : name,
              ]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#F69502"
              strokeWidth={2}
              fill="url(#colorPrice)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">High</div>
            <div className="font-semibold">
              {chartData.length > 0
                ? Math.max(...chartData.map((d) => d.high)).toFixed(4)
                : '—'}{' '}
              sBTC
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Low</div>
            <div className="font-semibold">
              {chartData.length > 0
                ? Math.min(...chartData.map((d) => d.low)).toFixed(4)
                : '—'}{' '}
              sBTC
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg</div>
            <div className="font-semibold">
              {chartData.length > 0
                ? (
                    chartData.reduce((sum, d) => sum + d.price, 0) / chartData.length
                  ).toFixed(4)
                : '—'}{' '}
              sBTC
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Data Points</div>
            <div className="font-semibold">{chartData.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
