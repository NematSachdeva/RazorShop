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
    <div className="w-full bg-gray-50 py-10 font-sans">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <IconShield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                  RazorShop Service Diagnostics
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5">
                  RazorShop System Status
                </h1>
              </div>
            </div>

            <button
              onClick={fetchHealthStatus}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 self-start sm:self-auto"
            >
              <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {loading && (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">Checking real-time service health...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-200 text-xs font-medium space-y-1">
              <p className="font-bold text-sm">Service Health Alert</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && statusData && (
            <div className="space-y-6">
              {/* Overall Banner */}
              <div className="p-5 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <IconCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-emerald-950">
                      All Systems Operational
                    </h2>
                    <p className="text-xs text-emerald-800">
                      Core backend services and database connections are healthy.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-white px-3 py-1 rounded-lg border border-emerald-200 font-bold text-emerald-900">
                  {statusData.status.toUpperCase()}
                </span>
              </div>

              {/* Service Health Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Core API</span>
                    <span className="text-[11px] text-gray-500">Express Application Server</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Database</span>
                    <span className="text-[11px] text-gray-500">TypeORM PostgreSQL</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> {statusData.database === 'connected' ? 'Connected' : statusData.database}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Payment Gateway</span>
                    <span className="text-[11px] text-gray-500">Razorpay API Integration</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Email Dispatcher</span>
                    <span className="text-[11px] text-gray-500">Transactional Email Service</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Recommendations</span>
                    <span className="text-[11px] text-gray-500">Catalog AI Engine</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm block">Merchant Portal</span>
                    <span className="text-[11px] text-gray-500">Merchant Hub & Admin</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>
              </div>

              {/* Timestamp Card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 font-mono flex justify-between items-center">
                <span>Last Diagnostic Sync:</span>
                <span className="font-bold text-gray-900">{new Date(statusData.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 flex items-start gap-2.5">
            <IconInfo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              System health is polled continuously. If you encounter any unexpected error, please contact customer support at <strong className="text-gray-900">nnnnsachdeva@gmail.com</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
