/**
 * PaymentFailureReasons Component
 * Displays breakdown of payment failure reasons and recovery rates
 */

interface FailureReason {
  reason: string;
  count: number;
  total_amount_cents: number;
  recovery_count: number;
  recovery_rate_percent: number;
}

interface FailureReasonsData {
  reasons: FailureReason[];
  total_failures: number;
  total_amount_cents: number;
}

interface PaymentFailureReasonsProps {
  reasons: FailureReasonsData;
}

export default function PaymentFailureReasons({ reasons }: PaymentFailureReasonsProps) {
  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getReasonIcon = (reason: string) => {
    const icons: { [key: string]: string } = {
      card_declined: '🚫',
      insufficient_funds: '💸',
      expired_card: '⏰',
      network_error: '🌐',
      gateway_error: '⚙️',
      timeout: '⏳',
      authentication_failed: '🔐',
      unknown: '❓',
    };
    return icons[reason] || '❌';
  };

  const getReasonColor = (rate: number) => {
    if (rate >= 70) return 'bg-green-50 border-green-200';
    if (rate >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="bg-white rounded shadow p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Failure Reasons</h2>

      {reasons.total_failures === 0 ? (
        <p className="text-gray-500 py-4">No payment failures</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Reason</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Count</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Amount</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Recovered</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Recovery Rate</th>
                </tr>
              </thead>
              <tbody>
                {reasons.reasons.map((reason, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium flex items-center gap-2">
                      <span>{getReasonIcon(reason.reason)}</span>
                      {reason.reason.replace(/_/g, ' ').charAt(0).toUpperCase() + reason.reason.slice(1).replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700 font-semibold">{reason.count}</td>
                    <td className="py-3 px-2 text-right text-gray-700">{formatPrice(reason.total_amount_cents)}</td>
                    <td className="py-3 px-2 text-right text-gray-700">{reason.recovery_count}</td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded ${getReasonColor(reason.recovery_rate_percent)} font-semibold`}
                      >
                        {reason.recovery_rate_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">Total Failures</p>
              <p className="text-2xl font-bold text-gray-900">{reasons.total_failures}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(reasons.total_amount_cents)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-xs text-gray-600 mb-1">Average Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(reasons.total_failures > 0 ? reasons.total_amount_cents / reasons.total_failures : 0)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
