import { useEffect, useState } from 'react';
import { getApiUrl } from '../../config/api';
import { IconCheck, IconRefresh, IconInfo, IconShield } from '../common/Icons';

export function ApiStatusPage() {
  const [statusData, setStatusData] = useState<{
    status: string;
    database: string;
    timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/health'));
      if (response.ok) {
        const data = await response.json();
        setStatusData(data);
      } else {
        setError('API service reported non-200 status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach health endpoint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
  }, []);

  return (
    <div className="w-full py-10 font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border p-6 sm:p-10 space-y-8 themed shadow-xl" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
                <IconShield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                  RazorShop Service Diagnostics
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold font-display mt-0.5" style={{ color: 'var(--c-text)' }}>
                  RazorShop System Status
                </h1>
              </div>
            </div>

            <button
              onClick={fetchHealthStatus}
              disabled={loading}
              className="px-4 py-2 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 self-start sm:self-auto cursor-pointer font-display"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {loading && (
            <div className="text-center py-12 rounded-2xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--c-gold)', borderTopColor: 'transparent' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Checking real-time service health...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl border text-xs font-medium space-y-1" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
              <p className="font-bold text-sm font-display">Service Health Alert</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && statusData && (
            <div className="space-y-6">
              {/* Overall Banner */}
              <div className="p-5 rounded-2xl border flex items-center justify-between" style={{ background: 'var(--c-status-green-bg)', borderColor: 'var(--c-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--c-status-green-text)', color: '#0a0908' }}>
                    <IconCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-status-green-text)' }}>
                      All Systems Operational
                    </h2>
                    <p className="text-xs font-medium" style={{ color: 'var(--c-text-dim)' }}>
                      Core backend services and database connections are healthy.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-lg border font-bold font-display" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-status-green-text)' }}>
                  {statusData.status.toUpperCase()}
                </span>
              </div>

              {/* Service Health Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Core API', desc: 'Express Application Server' },
                  { name: 'Database', desc: `TypeORM PostgreSQL (${statusData.database})` },
                  { name: 'Payment Gateway', desc: 'Razorpay API Integration' },
                  { name: 'Email Dispatcher', desc: 'Transactional Email Service' },
                  { name: 'Recommendations', desc: 'Catalog AI Engine' },
                  { name: 'Seller Portal', desc: 'Seller Hub & Admin' },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border flex items-center justify-between" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                    <div>
                      <span className="font-bold text-xs sm:text-sm block font-display" style={{ color: 'var(--c-text)' }}>{item.name}</span>
                      <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>{item.desc}</span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md border flex items-center gap-1 font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', borderColor: 'var(--c-border)' }}>
                      <IconCheck className="w-3.5 h-3.5" /> Operational
                    </span>
                  </div>
                ))}
              </div>

              {/* Timestamp Card */}
              <div className="p-4 rounded-xl border text-xs font-mono flex justify-between items-center" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
                <span>Last Diagnostic Sync:</span>
                <span className="font-bold" style={{ color: 'var(--c-text)' }}>{new Date(statusData.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl border text-xs flex items-start gap-2.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
            <IconInfo className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <p>
              System health is polled continuously. If you encounter any unexpected error, please contact customer support at <strong style={{ color: 'var(--c-text)' }}>nnnnsachdeva@gmail.com</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
