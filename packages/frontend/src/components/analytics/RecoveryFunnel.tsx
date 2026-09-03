/**
 * RecoveryFunnel Component
 * Displays recovery case funnel with status breakdown
 * Redesigned using Figma theme tokens
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
    { label: 'Open', count: funnel.open, color: 'var(--c-status-blue-text)', icon: '📥' },
    { label: 'In Progress', count: funnel.in_progress, color: 'var(--c-status-amber-text)', icon: '⏳' },
    { label: 'Resolved', count: funnel.resolved, color: 'var(--c-status-green-text)', icon: '✅' },
    { label: 'Abandoned', count: funnel.abandoned, color: 'var(--c-muted)', icon: '❌' },
    { label: 'Customer Declined', count: funnel.customer_declined, color: 'var(--c-status-red-text)', icon: '🚫' },
  ];

  const maxCount = Math.max(...statuses.map(s => s.count), 1);

  return (
    <div
      className="rounded-2xl border p-6 shadow-xs themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      <h2 className="text-xl font-bold font-display mb-4" style={{ color: 'var(--c-text)' }}>
        Recovery Funnel
      </h2>

      <div className="space-y-4">
        {statuses.map((status, idx) => {
          const percentage = maxCount > 0 ? (status.count / maxCount) * 100 : 0;
          return (
            <div key={idx}>
              <div className="flex justify-between mb-1.5 text-xs font-medium">
                <span className="flex items-center gap-2" style={{ color: 'var(--c-text-dim)' }}>
                  <span>{status.icon}</span>
                  {status.label}
                </span>
                <span className="font-bold font-display text-sm" style={{ color: 'var(--c-text)' }}>{status.count}</span>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--c-surface2)' }}>
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%`, background: status.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4 mt-6" style={{ borderColor: 'var(--c-border)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 font-display" style={{ color: 'var(--c-gold)' }}>
          Conversion Rates
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
            <p className="text-[11px] font-medium" style={{ color: 'var(--c-muted)' }}>Open → Resolved</p>
            <p className="text-xl font-bold font-display" style={{ color: 'var(--c-status-green-text)' }}>{funnel.conversion_rates.open_to_resolved}%</p>
          </div>
          <div className="p-3 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
            <p className="text-[11px] font-medium" style={{ color: 'var(--c-muted)' }}>Open → In Progress</p>
            <p className="text-xl font-bold font-display" style={{ color: 'var(--c-status-amber-text)' }}>{funnel.conversion_rates.open_to_in_progress}%</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border mt-4 flex items-center justify-between" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
        <span className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-muted)' }}>Total Recovery Cases</span>
        <span className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>{funnel.total}</span>
      </div>
    </div>
  );
}
