/**
 * RevenueMetrics Component
 * Displays key revenue indicators
 */

interface MetricsData {
  total_revenue_cents: number;
  revenue_at_risk_cents: number;
  revenue_recovered_cents: number;
  failed_payments_count: number;
  failed_payments_total_cents: number;
  abandoned_carts_count: number;
  recovery_rate_percent: number;
  period: {
    start_date: string;
    end_date: string;
  };
}

interface RevenueMetricsProps {
  metrics: MetricsData;
}

export default function RevenueMetrics({ metrics }: RevenueMetricsProps) {
  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const metricCards = [
    {
      label: 'Total Revenue',
      value: formatPrice(metrics.total_revenue_cents),
      icon: '💰',
      color: 'bg-green-50 border-green-200',
    },
    {
      label: 'Revenue at Risk',
      value: formatPrice(metrics.revenue_at_risk_cents),
      icon: '⚠️',
      color: 'bg-yellow-50 border-yellow-200',
    },
    {
      label: 'Revenue Recovered',
      value: formatPrice(metrics.revenue_recovered_cents),
      icon: '✅',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      label: 'Failed Payments',
      value: metrics.failed_payments_count.toString(),
      subtext: formatPrice(metrics.failed_payments_total_cents),
      icon: '❌',
      color: 'bg-red-50 border-red-200',
    },
    {
      label: 'Abandoned Carts',
      value: metrics.abandoned_carts_count.toString(),
      icon: '🛒',
      color: 'bg-orange-50 border-orange-200',
    },
    {
      label: 'Recovery Rate',
      value: `${metrics.recovery_rate_percent}%`,
      icon: '📈',
      color: 'bg-purple-50 border-purple-200',
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Revenue Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className={`border-l-4 rounded p-4 ${card.color}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {card.subtext && <p className="text-xs text-gray-500 mt-1">{card.subtext}</p>}
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
