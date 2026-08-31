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
      accent: 'border-emerald-500 bg-emerald-50/70',
      badgeColor: 'text-emerald-700 bg-emerald-100',
    },
    {
      label: 'Revenue at Risk',
      value: formatPrice(metrics.revenue_at_risk_cents),
      accent: 'border-amber-500 bg-amber-50/70',
      badgeColor: 'text-amber-700 bg-amber-100',
    },
    {
      label: 'Revenue Recovered',
      value: formatPrice(metrics.revenue_recovered_cents),
      accent: 'border-blue-500 bg-blue-50/70',
      badgeColor: 'text-blue-700 bg-blue-100',
    },
    {
      label: 'Orders Cancelled',
      value: (metrics.orders_cancelled_count || 0).toString(),
      subtext: 'Customer cancellations',
      accent: 'border-rose-500 bg-rose-50/70',
      badgeColor: 'text-rose-700 bg-rose-100',
    },
    {
      label: 'Orders Returned',
      value: (metrics.orders_returned_count || 0).toString(),
      subtext: 'Returned to seller',
      accent: 'border-purple-500 bg-purple-50/70',
      badgeColor: 'text-purple-700 bg-purple-100',
    },
    {
      label: 'Failed Payments',
      value: metrics.failed_payments_count.toString(),
      subtext: formatPrice(metrics.failed_payments_total_cents),
      accent: 'border-red-500 bg-red-50/70',
      badgeColor: 'text-red-700 bg-red-100',
    },
    {
      label: 'Abandoned Carts',
      value: metrics.abandoned_carts_count.toString(),
      accent: 'border-orange-500 bg-orange-50/70',
      badgeColor: 'text-orange-700 bg-orange-100',
    },
    {
      label: 'Recovery Rate',
      value: `${metrics.recovery_rate_percent}%`,
      accent: 'border-indigo-500 bg-indigo-50/70',
      badgeColor: 'text-indigo-700 bg-indigo-100',
    },
  ];

  return (
    <div className="mb-8 font-sans">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">Financial Overview</span>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">Revenue & Order Metrics</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className={`border border-gray-200 border-l-4 rounded-2xl p-5 shadow-xs bg-white transition hover:shadow-md ${card.accent}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-1">{card.label}</p>
                <p className="text-2xl font-black text-gray-900">{card.value}</p>
                {card.subtext && <p className="text-xs font-semibold text-gray-600 mt-1">{card.subtext}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
