import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getApiUrl } from '../config/api';
import Footer from './Footer';
import { IconRefresh, IconCheck, IconClose } from './common/Icons';

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 w-full">
      {/* Light Header */}
      <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              onClick={() => {
                if (data?.status === 'approved' && onGoToDashboard) {
                  onGoToDashboard();
                } else {
                  window.location.href = '/';
                }
              }}
              className="cursor-pointer group flex items-center gap-2 select-none"
              title="RazorShop Home"
            >
              <span className="text-2xl font-black tracking-tight text-gray-900">
                Razor<span className="text-blue-600">Shop</span>
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
              Merchant Application
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-bold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition flex items-center gap-1.5"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-200"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-semibold text-xs text-gray-500">Loading merchant application timeline...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-5 rounded-2xl text-xs font-bold space-y-2">
            <p className="font-bold text-sm">Application Status Alert</p>
            <p>{error}</p>
            <button
              onClick={fetchStatus}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition"
            >
              Retry Loading
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {/* Hero Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                <div>
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                    Merchant Onboarding
                  </span>
                  <h2 className="text-2xl font-black text-gray-900 mt-0.5">{data.business_name}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Applicant: <strong className="text-gray-800">{data.name}</strong> ({data.email})
                  </p>
                </div>
                <div>{getStatusBadge(data.status)}</div>
              </div>

              {/* Status Specific Banners */}
              {data.status === 'approved' && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-emerald-900 flex items-center gap-2">
                      <IconCheck className="w-5 h-5 text-emerald-600" />
                      <span>Congratulations! Your application has been approved.</span>
                    </h3>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Your merchant account is active. You have complete access to store analytics, inventory management, and fulfillment tools.
                    </p>
                  </div>
                  {onGoToDashboard && (
                    <button
                      onClick={onGoToDashboard}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition whitespace-nowrap"
                    >
                      Enter Merchant Dashboard
                    </button>
                  )}
                </div>
              )}

              {data.status === 'rejected' && (
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl text-rose-950 space-y-3">
                  <h3 className="font-extrabold text-base text-rose-900 flex items-center gap-2">
                    <IconClose className="w-5 h-5 text-rose-600" />
                    <span>Application Not Approved</span>
                  </h3>
                  <p className="text-xs font-bold text-gray-700">Rejection Reason Provided by Administrator:</p>
                  <div className="bg-white border border-rose-200 p-4 rounded-xl text-xs italic text-rose-900 font-medium">
                    "{data.rejection_reason || 'Application did not satisfy current onboarding requirements.'}"
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    If you believe this was an error or would like to update your submission details, please contact support at <a href="mailto:nnnnsachdeva@gmail.com" className="text-blue-600 underline font-bold">nnnnsachdeva@gmail.com</a>.
                  </p>
                </div>
              )}

              {data.status === 'pending' && (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl text-amber-950 space-y-1">
                  <h3 className="font-extrabold text-sm text-amber-900">Verification in Progress</h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Our compliance team is currently reviewing your merchant application. This verification step protects customers and platform integrity. You will automatically receive access once approved.
                  </p>
                </div>
              )}

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[10px]">
                    Application Reference ID
                  </span>
                  <span className="font-mono text-gray-900 text-xs font-bold">{data.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[10px]">
                    Submitted Date
                  </span>
                  <span className="text-gray-900 font-bold">
                    {new Date(data.submitted_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-gray-200/60">
                  <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[10px] mb-0.5">
                    Business Justification
                  </span>
                  <span className="text-gray-800 italic">{data.reason}</span>
                </div>
              </div>
            </div>

            {/* Persistent Audit Timeline */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                    Audit Trail
                  </span>
                  <h3 className="text-lg font-black text-gray-900">Persistent Application Timeline</h3>
                </div>
                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 font-mono">
                  {data.timeline?.length || 0} Events Logged
                </span>
              </div>

              <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                {data.timeline && data.timeline.length > 0 ? (
                  data.timeline.map((event) => (
                    <div key={event.id} className="relative pl-6">
                      {/* Node Dot */}
                      <div
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${
                          event.event_type === 'APPROVED'
                            ? 'bg-emerald-500 border-white'
                            : event.event_type === 'REJECTED'
                            ? 'bg-rose-500 border-white'
                            : 'bg-blue-500 border-white'
                        }`}
                      />

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              event.event_type === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : event.event_type === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {new Date(event.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <p className="text-xs text-gray-800 font-medium">
                          {event.description || 'Timeline event recorded'}
                        </p>

                        <div className="text-[10px] text-gray-500 pt-1 flex items-center gap-2">
                          <span>
                            Actor Role: <strong className="text-gray-800 uppercase">{event.actor_role}</strong>
                          </span>
                          {event.actor_id && <span className="font-mono text-[9px]">({event.actor_id})</span>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 pl-4 italic">No timeline events recorded.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Universal Light Footer */}
      <Footer
        onNavigateToStore={() => { window.location.href = '/'; }}
        onNavigateToOrders={() => { window.location.href = '/orders'; }}
        onOpenCart={() => { window.location.href = '/'; }}
        onOpenPrivacy={() => { window.location.href = '/privacy'; }}
        onOpenTerms={() => { window.location.href = '/terms'; }}
        onOpenContact={() => { window.location.href = '/support'; }}
        onOpenApiStatus={() => { window.location.href = '/status'; }}
      />
    </div>
  );
}
