/**
 * RevenueTimeline Component
 * Displays daily revenue, orders, failed payments, and recoveries
 */

interface DailyDataPoint {
  date: string;
  revenue_cents: number;
  orders_count: number;
  failed_payments_count: number;
  recovered_amount_cents: number;
}

interface TimelineData {
  data: DailyDataPoint[];
  period: {
    start_date: string;
    end_date: string;
  };
  totals: {
    revenue_cents: number;
    orders_count: number;
    failed_payments_count: number;
    recovered_amount_cents: number;
  };
}

interface RevenueTimelineProps {
  timeline: TimelineData;
}

export default function RevenueTimeline({ timeline }: RevenueTimelineProps) {
  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  // Get max values for scaling
  const maxRevenue = Math.max(...timeline.data.map(d => d.revenue_cents), 1);
  const maxRecovered = Math.max(...timeline.data.map(d => d.recovered_amount_cents), 1);

  return (
    <div className="bg-white rounded shadow p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Revenue Timeline</h2>

      {timeline.data.length === 0 ? (
        <p className="text-gray-500 py-4">No data available for this period</p>
      ) : (
        <>
          {/* Chart-like visualization */}
          <div className="overflow-x-auto mb-6">
            <div className="flex gap-1 items-end h-48 min-w-full pr-4">
              {timeline.data.map((point, idx) => {
                const revenueHeight = (point.revenue_cents / maxRevenue) * 100;
                const recoveredHeight = (point.recovered_amount_cents / maxRecovered) * 100;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex items-end justify-center gap-0.5 h-full mb-2">
                      {/* Revenue bar */}
                      <div
                        className="flex-1 bg-blue-400 rounded-t opacity-70 hover:opacity-100 transition"
                        style={{ height: `${revenueHeight}%` }}
                        title={`Revenue: ${formatPrice(point.revenue_cents)}`}
                      />
                      {/* Recovered bar */}
                      <div
                        className="flex-1 bg-green-400 rounded-t opacity-70 hover:opacity-100 transition"
                        style={{ height: `${recoveredHeight}%` }}
                        title={`Recovered: ${formatPrice(point.recovered_amount_cents)}`}
                      />
                    </div>
                    <span className="text-xs text-gray-600 text-center max-w-12 leading-tight">
                      {formatDate(point.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-6 mb-6 pb-6 border-b">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-400 rounded"></div>
              <span className="text-sm text-gray-700">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-400 rounded"></div>
              <span className="text-sm text-gray-700">Recovered Amount</span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
              <p className="text-xs text-gray-600 mb-1">Total Revenue</p>
              <p className="text-lg font-bold text-blue-900">{formatPrice(timeline.totals.revenue_cents)}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-400">
              <p className="text-xs text-gray-600 mb-1">Total Orders</p>
              <p className="text-lg font-bold text-yellow-900">{timeline.totals.orders_count}</p>
            </div>
            <div className="bg-red-50 p-4 rounded border-l-4 border-red-400">
              <p className="text-xs text-gray-600 mb-1">Failed Payments</p>
              <p className="text-lg font-bold text-red-900">{timeline.totals.failed_payments_count}</p>
            </div>
            <div className="bg-green-50 p-4 rounded border-l-4 border-green-400">
              <p className="text-xs text-gray-600 mb-1">Total Recovered</p>
              <p className="text-lg font-bold text-green-900">{formatPrice(timeline.totals.recovered_amount_cents)}</p>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-2 font-semibold text-gray-700">Date</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">Orders</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">Failed</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-700">Recovered</th>
                </tr>
              </thead>
              <tbody>
                {timeline.data.map((point, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-900">{formatDate(point.date)}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{formatPrice(point.revenue_cents)}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{point.orders_count}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{point.failed_payments_count}</td>
                    <td className="py-2 px-2 text-right text-green-600 font-medium">
                      {formatPrice(point.recovered_amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
