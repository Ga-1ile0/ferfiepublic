import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { availableTokens } from '@/lib/tokens';

interface PriceChartProps {
    fromToken: string;
    toToken: string;
    currentRate: number;
    height?: number;
}

export function PriceChart({ fromToken, toToken, currentRate, height = 120 }: PriceChartProps) {
    const [data, setData] = useState<{ time: string; price: number }[]>([]);
    const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

    const toTokenSymbol =
        availableTokens.find(t => t.contract.toLowerCase() === toToken.toLowerCase())?.symbol ||
        'Token';

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const { chartData } = await import('@/lib/tokens');
                const chartDataResult = await chartData(fromToken, toToken);

                if (chartDataResult.length > 0) {
                    const sortedData = [...chartDataResult].sort(
                        (a, b) => parseInt(b.time) - parseInt(a.time)
                    );

                    const firstPrice = sortedData[0].price;
                    const lastPrice = sortedData[sortedData.length - 1].price;

                    if (lastPrice > firstPrice * 1.005) {
                        setTrend('up');
                    } else if (lastPrice < firstPrice * 0.995) {
                        setTrend('down');
                    } else {
                        setTrend('neutral');
                    }

                    setData(sortedData);
                }
            } catch (error) {
                console.error('Error fetching chart data:', error);
            }
        };

        fetchChartData();
    }, [currentRate]);

    const minValue = Math.min(...data.map(d => d.price)) * 0.995;
    const maxValue = Math.max(...data.map(d => d.price)) * 1.005;
    const startValue = data[0]?.price || 0;
    const currentValue = data[data.length - 1]?.price || 0;
    const percentChange = startValue ? ((currentValue - startValue) / startValue) * 100 : 0;
    const formattedPercentChange = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

    return (
        <div className="overflow-hidden border-2 rounded-lg">
            <div className="p-3">
                <p className="text-sm text-muted-foreground mt-1 flex justify-between">
                    Past 24 hours{' '}
                    <span
                        className={cn(
                            'text-sm font-medium',
                            trend === 'up'
                                ? 'text-emerald-500 dark:text-emerald-400'
                                : trend === 'down'
                                    ? 'text-red-500 dark:text-red-400'
                                    : 'text-muted-foreground'
                        )}
                    >
                        {formattedPercentChange}
                    </span>
                </p>
            </div>

            <div className="h-[120px] w-full px-2">
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                            tickFormatter={value => (value === '0h' ? 'Now' : value === '24h' ? '24h' : '')}
                        />
                        <YAxis domain={[minValue, maxValue]} hide={true} />
                        <Tooltip
                            formatter={(value: number) => [value.toFixed(6), `${toTokenSymbol} Price`]}
                            labelFormatter={label => (label === '0h' ? 'Now' : `${label} ago`)}
                            contentStyle={{
                                backgroundColor: '#fff1d6',
                                borderColor: '#000000',
                                borderWidth: '2px',
                                borderRadius: '0.5rem',
                                fontSize: '0.75rem',
                            }}
                        />
                        <ReferenceLine y={currentRate} stroke="#e87f4e" strokeDasharray="3 3" />
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke={trend === 'up' ? '#0e6906' : trend === 'down' ? '#913030' : '#080d47'}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                                r: 4,
                                fill:
                                    trend === 'up'
                                        ? 'hsl(var(--chart-1))'
                                        : trend === 'down'
                                            ? 'hsl(var(--chart-3))'
                                            : 'hsl(var(--chart-2))',
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
