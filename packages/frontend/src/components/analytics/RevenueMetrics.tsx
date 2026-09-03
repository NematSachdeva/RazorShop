/**
 * RevenueMetrics Component
 * Displays key revenue indicators in a unified grid matching reference screenshots
 */

interface MetricsData {
  total_revenue_cents: number;
  revenue_at_risk_cents: number;
  revenue_recovered_cents: number;
  failed_payments_count: number;
  failed_payments_total_cents: number;
  abandoned_carts_count: number;
  recovery_rate_percent: number;
  orders_cancelled_count?: number;
  orders_returned_count?: number;
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
      accent: 'var(--c-text)',
    },
    {
      label: 'Revenue at Risk',
      value: formatPrice(metrics.revenue_at_risk_cents),
      accent: 'var(--c-gold)',
    },
    {
      label: 'Revenue Recovered',
      value: formatPrice(metrics.revenue_recovered_cents),
      accent: 'var(--c-status-green-text)',
    },
    {
      label: 'Orders Cancelled',
      value: (metrics.orders_cancelled_count || 0).toString(),
      accent: 'var(--c-status-red-text)',
    },
    {
      label: 'Orders Returned',
      value: (metrics.orders_returned_count || 0).toString(),
      accent: 'var(--c-text)',
    },
    {
      label: 'Failed Payments',
      value: metrics.failed_payments_count.toString(),
      accent: 'var(--c-status-red-text)',
    },
    {
      label: 'Abandoned Carts',
      value: metrics.abandoned_carts_count.toString(),
      accent: 'var(--c-gold)',
    },
    {
      label: 'Recovery Rate',
      value: `${metrics.recovery_rate_percent}%`,
      accent: 'var(--c-status-green-text)',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border rounded-2xl overflow-hidden themed font-sans" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
      {metricCards.map((card, idx) => {
        const isBottomRow = idx >= 4;
        const isRightmostCol = (idx + 1) % 4 === 0;

        return (
          <div
            key={idx}
            className="p-6 space-y-2 font-display"
            style={{
              borderColor: 'var(--c-border-soft)',
              borderBottomWidth: isBottomRow ? '0px' : '1px',
              borderRightWidth: isRightmostCol ? '0px' : '1px',
              borderStyle: 'solid',
            }}
          >
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: card.accent }}>
              {card.value}
            </p>
            <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
              {card.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
