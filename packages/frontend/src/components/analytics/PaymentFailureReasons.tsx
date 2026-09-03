/**
 * PaymentFailureReasons Component
 * Displays breakdown of payment failure reasons and recovery rates
 * Redesigned using Figma design system tokens
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

  return (
    <div
      className="rounded-2xl border p-6 mb-8 shadow-xs themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      <h2 className="text-xl font-bold font-display mb-4" style={{ color: 'var(--c-text)' }}>
        Payment Failure Reasons
      </h2>

      {reasons.total_failures === 0 ? (
        <p className="py-4 font-medium text-xs" style={{ color: 'var(--c-muted)' }}>No payment failures recorded</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--c-border)' }}>
            <table className="w-full text-xs text-left">
              <thead className="border-b font-bold font-display uppercase tracking-wider" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
                <tr>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Count</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Recovered</th>
                  <th className="py-3 px-4 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--c-border-soft)' }}>
                {reasons.reasons.map((reason, idx) => (
                  <tr key={idx} className="font-medium hover:bg-amber-500/5 transition">
                    <td className="py-3 px-4 font-bold flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
                      <span>{getReasonIcon(reason.reason)}</span>
                      {reason.reason.replace(/_/g, ' ').charAt(0).toUpperCase() + reason.reason.slice(1).replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: 'var(--c-text)' }}>{reason.count}</td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--c-text-dim)' }}>{formatPrice(reason.total_amount_cents)}</td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--c-text-dim)' }}>{reason.recovery_count}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className="inline-block px-2 py-0.5 rounded font-extrabold font-display"
                        style={{
                          background: reason.recovery_rate_percent >= 70
                            ? 'var(--c-status-green-bg)'
                            : reason.recovery_rate_percent >= 40
                            ? 'var(--c-status-amber-bg)'
                            : 'var(--c-status-red-bg)',
                          color: reason.recovery_rate_percent >= 70
                            ? 'var(--c-status-green-text)'
                            : reason.recovery_rate_percent >= 40
                            ? 'var(--c-status-amber-text)'
                            : 'var(--c-status-red-text)',
                        }}
                      >
                        {reason.recovery_rate_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: 'var(--c-border)' }}>
            <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 font-display" style={{ color: 'var(--c-muted)' }}>Total Failures</p>
              <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>{reasons.total_failures}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 font-display" style={{ color: 'var(--c-muted)' }}>Total Amount</p>
              <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>{formatPrice(reasons.total_amount_cents)}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 font-display" style={{ color: 'var(--c-muted)' }}>Average Amount</p>
              <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
                {formatPrice(reasons.total_failures > 0 ? reasons.total_amount_cents / reasons.total_failures : 0)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
