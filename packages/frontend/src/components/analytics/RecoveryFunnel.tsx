/**
 * RecoveryFunnel Component
 * Displays recovery case funnel with status breakdown
 */

interface FunnelData {
  open: number;
  in_progress: number;
  resolved: number;
  abandoned: number;
  customer_declined: number;
  total: number;
  conversion_rates: {
    open_to_resolved: number;
    open_to_in_progress: number;
  };
}

interface RecoveryFunnelProps {
  funnel: FunnelData;
}

export default function RecoveryFunnel({ funnel }: RecoveryFunnelProps) {
  const statuses = [
    { label: 'Open', count: funnel.open, color: 'bg-blue-100 border-blue-300', icon: '📥' },
    { label: 'In Progress', count: funnel.in_progress, color: 'bg-yellow-100 border-yellow-300', icon: '⏳' },
    { label: 'Resolved', count: funnel.resolved, color: 'bg-green-100 border-green-300', icon: '✅' },
    { label: 'Abandoned', count: funnel.abandoned, color: 'bg-gray-100 border-gray-300', icon: '❌' },
    { label: 'Customer Declined', count: funnel.customer_declined, color: 'bg-red-100 border-red-300', icon: '🚫' },
  ];

  const maxCount = Math.max(...statuses.map(s => s.count), 1);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Recovery Funnel</h2>

      <div className="space-y-4">
        {statuses.map((status, idx) => {
          const percentage = maxCount > 0 ? (status.count / maxCount) * 100 : 0;
          return (
            <div key={idx}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>{status.icon}</span>
                  {status.label}
                </span>
                <span className="text-sm font-bold text-gray-900">{status.count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${status.color}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Conversion Rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded">
            <p className="text-xs text-gray-600">Open → Resolved</p>
            <p className="text-lg font-bold text-blue-600">{funnel.conversion_rates.open_to_resolved}%</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded">
            <p className="text-xs text-gray-600">Open → In Progress</p>
            <p className="text-lg font-bold text-yellow-600">{funnel.conversion_rates.open_to_in_progress}%</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded mt-4">
        <p className="text-xs text-gray-600">Total Recovery Cases</p>
        <p className="text-2xl font-bold text-gray-900">{funnel.total}</p>
      </div>
    </div>
  );
}
