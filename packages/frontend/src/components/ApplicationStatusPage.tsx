import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getApiUrl } from '../config/api';

interface TimelineEvent {
  id: string;
  event_type: 'APPLICATION_SUBMITTED' | 'APPROVED' | 'REJECTED';
  actor_id?: string;
  actor_role: 'applicant' | 'admin' | 'system';
  description?: string;
  created_at: string;
}

interface ApplicationStatusData {
  id: string;
  customer_id: string;
  email: string;
  name: string;
  business_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  timeline: TimelineEvent[];
}

interface ApplicationStatusPageProps {
  onGoToDashboard?: () => void;
  onLogout?: () => void;
}

export default function ApplicationStatusPage({ onGoToDashboard, onLogout }: ApplicationStatusPageProps) {
  const [data, setData] = useState<ApplicationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/merchant/application-status'), {
        headers: {
          Authorization: `Bearer ${authService.getToken()}`,
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to fetch application status');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching application status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 inline-flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Approved & Active
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 inline-flex">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Application Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 inline-flex">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Under Administrator Review
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300 space-y-3">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-semibold text-sm">Loading application timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/80 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-black tracking-tight text-purple-400">RAZOR</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-widest">
                Merchant Portal
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-200">Merchant Account Application Status</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              className="px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
            >
              🔄 Refresh Status
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-bold bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl transition border border-rose-800/50"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Status Hero Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Store Name</p>
                  <h2 className="text-2xl font-extrabold text-white mt-0.5">{data.business_name}</h2>
                  <p className="text-xs text-slate-400 mt-1">Applicant: {data.name} ({data.email})</p>
                </div>
                <div>{getStatusBadge(data.status)}</div>
              </div>

              {/* Status Specific Banners */}
              {data.status === 'approved' && (
                <div className="bg-emerald-950/60 border border-emerald-700/50 p-5 rounded-xl text-emerald-200 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-base text-emerald-400">🎉 Congratulations! Your application has been approved.</h3>
                    <p className="text-xs text-emerald-300/90 mt-1">
                      Your merchant account is now active. You have full access to analytics, inventory management, and AI recovery tools.
                    </p>
                  </div>
                  {onGoToDashboard && (
                    <button
                      onClick={onGoToDashboard}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition whitespace-nowrap"
                    >
                      Enter Merchant Dashboard →
                    </button>
                  )}
                </div>
              )}

              {data.status === 'rejected' && (
                <div className="bg-rose-950/60 border border-rose-800/80 p-5 rounded-xl text-rose-200 mb-6 space-y-2">
                  <h3 className="font-extrabold text-base text-rose-400">❌ Application Not Approved</h3>
                  <p className="text-xs font-bold text-slate-300">Rejection Reason Provided by Administrator:</p>
                  <div className="bg-slate-950/80 border border-rose-900/60 p-3.5 rounded-lg text-sm italic text-rose-300">
                    "{data.rejection_reason || 'Application did not satisfy current onboarding requirements.'}"
                  </div>
                  <p className="text-xs text-slate-400 pt-2">
                    If you believe this was an error or would like to submit updated documentation, please contact support.
                  </p>
                </div>
              )}

              {data.status === 'pending' && (
                <div className="bg-amber-950/40 border border-amber-700/40 p-5 rounded-xl text-amber-200 mb-6">
                  <h3 className="font-extrabold text-sm text-amber-300">⏳ Verification in Progress</h3>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Our compliance team is currently reviewing your merchant application. This process ensures platform security and compliance. You will automatically receive access once approved.
                  </p>
                </div>
              )}

              {/* Application Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Application ID</span>
                  <span className="font-mono text-slate-200 text-xs">{data.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Submitted Date</span>
                  <span className="text-slate-200">{new Date(data.submitted_at).toLocaleString()}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px] mb-0.5">Business Justification</span>
                  <span className="text-slate-300 italic">{data.reason}</span>
                </div>
              </div>
            </div>

            {/* Persistent Database Timeline Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
                <span>📜 Persistent Application Timeline</span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                  {data.timeline?.length || 0} events
                </span>
              </h3>

              <div className="relative border-l-2 border-slate-800 ml-3 space-y-6">
                {data.timeline && data.timeline.length > 0 ? (
                  data.timeline.map((event) => (
                    <div key={event.id} className="relative pl-6">
                      {/* Event node dot */}
                      <div
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${
                          event.event_type === 'APPROVED'
                            ? 'bg-emerald-500 border-emerald-200'
                            : event.event_type === 'REJECTED'
                            ? 'bg-rose-500 border-rose-200'
                            : 'bg-blue-500 border-blue-200'
                        }`}
                      ></div>

                      <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              event.event_type === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : event.event_type === 'REJECTED'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}
                          >
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">{event.description || 'Timeline event recorded'}</p>

                        <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-2">
                          <span>Actor: <strong className="text-slate-400">{event.actor_role}</strong></span>
                          {event.actor_id && <span className="font-mono text-[9px]">({event.actor_id})</span>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 pl-4 italic">No timeline events recorded.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
