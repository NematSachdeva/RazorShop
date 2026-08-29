/**
 * CustomerResponseBreakdown Component
 * Displays how customers responded to recovery attempts
 */

interface ResponseData {
  accepted: number;
  refused: number;
  promised: number;
  unclear: number;
  total: number;
  percentages: {
    accepted: number;
    refused: number;
    promised: number;
    unclear: number;
  };
}

interface CustomerResponseBreakdownProps {
  breakdown: ResponseData;
}

export default function CustomerResponseBreakdown({ breakdown }: CustomerResponseBreakdownProps) {
  const responses = [
    {
      label: 'Accepted',
      count: breakdown.accepted,
      percentage: breakdown.percentages.accepted,
      color: 'bg-green-100 border-green-300 text-green-700',
      icon: '✅',
    },
    {
      label: 'Refused',
      count: breakdown.refused,
      percentage: breakdown.percentages.refused,
      color: 'bg-red-100 border-red-300 text-red-700',
      icon: '❌',
    },
    {
      label: 'Promised',
      count: breakdown.promised,
      percentage: breakdown.percentages.promised,
      color: 'bg-blue-100 border-blue-300 text-blue-700',
      icon: '🤝',
    },
    {
      label: 'Unclear',
      count: breakdown.unclear,
      percentage: breakdown.percentages.unclear,
      color: 'bg-gray-100 border-gray-300 text-gray-700',
      icon: '❓',
    },
  ];

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Response Breakdown</h2>

      {breakdown.total === 0 ? (
        <p className="text-gray-500 py-4">No customer responses yet</p>
      ) : (
        <>
          <div className="space-y-3">
            {responses.map((response, idx) => (
              <div key={idx} className={`border-l-4 rounded p-3 ${response.color}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{response.icon}</span>
                    <div>
                      <p className="font-medium">{response.label}</p>
                      <p className="text-xs opacity-75">{response.count} responses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{response.percentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full ${response.color.split(' ')[0]}`}
                    style={{ width: `${response.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-3 rounded mt-4">
            <p className="text-xs text-gray-600">Total Responses</p>
            <p className="text-2xl font-bold text-gray-900">{breakdown.total}</p>
          </div>
        </>
      )}
    </div>
  );
}
