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
  const [isLightMode, setIsLightMode] = useState(() => document.documentElement.classList.contains('light'));

  const handleToggleTheme = () => {
    const isLight = document.documentElement.classList.contains('light');
    if (isLight) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsLightMode(false);
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsLightMode(true);
    }
  };

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
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 inline-flex font-display"
            style={{
              background: 'var(--c-status-green-bg)',
              color: 'var(--c-status-green-text)',
              borderColor: 'var(--c-border-soft)',
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--c-status-green-text)' }}></span>
            Approved & Active
          </span>
        );
      case 'rejected':
        return (
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 inline-flex font-display"
            style={{
              background: 'var(--c-status-red-bg)',
              color: 'var(--c-status-red-text)',
              borderColor: 'var(--c-border-soft)',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--c-status-red-text)' }}></span>
            Application Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 inline-flex font-display"
            style={{
              background: 'var(--c-status-amber-bg)',
              color: 'var(--c-status-amber-text)',
              borderColor: 'var(--c-border-soft)',
            }}
          >
            <span className="w-2 h-2 rounded-full animate-ping" style={{ background: 'var(--c-status-amber-text)' }}></span>
            Under Administrator Review
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans w-full themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {/* Header */}
      <header className="w-full border-b sticky top-0 z-30 shadow-xs font-sans" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        <div className="w-full px-6 py-3.5 flex justify-between items-center gap-4">
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
              <span className="text-2xl font-bold tracking-tight font-display" style={{ color: 'var(--c-text)' }}>
                Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
              </span>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-display"
              style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-border-soft)' }}
            >
              Merchant Application
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-sm"
              style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {isLightMode ? '🌙' : '☀️'}
            </button>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer font-display"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-bold rounded-xl transition border cursor-pointer font-display"
                style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border-soft)' }}
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
          <div className="text-center py-16 rounded-2xl border shadow-xs space-y-3" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--c-gold)', borderTopColor: 'transparent' }}></div>
            <p className="font-semibold text-xs" style={{ color: 'var(--c-muted)' }}>Loading merchant application timeline...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-5 rounded-2xl text-xs font-bold space-y-2 border" style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
            <p className="font-bold text-sm">Application Status Alert</p>
            <p>{error}</p>
            <button
              onClick={fetchStatus}
              className="px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer font-display"
              style={{ background: 'var(--c-status-red-text)' }}
            >
              Retry Loading
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {/* Hero Card */}
            <div className="rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--c-border-soft)' }}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                    Merchant Onboarding
                  </span>
                  <h2 className="text-2xl font-bold mt-0.5 font-display" style={{ color: 'var(--c-text)' }}>{data.business_name}</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                    Applicant: <strong style={{ color: 'var(--c-text)' }}>{data.name}</strong> ({data.email})
                  </p>
                </div>
                <div>{getStatusBadge(data.status)}</div>
              </div>

              {/* Status Specific Banners */}
              {data.status === 'approved' && (
                <div className="p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--c-status-green-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-green-text)' }}>
                  <div className="space-y-1">
                    <h3 className="font-bold text-base flex items-center gap-2 font-display" style={{ color: 'var(--c-status-green-text)' }}>
                      <IconCheck className="w-5 h-5" style={{ color: 'var(--c-status-green-text)' }} />
                      <span>Congratulations! Your application has been approved.</span>
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ opacity: 0.9 }}>
                      Your merchant account is active. You have complete access to store analytics, inventory management, and fulfillment tools.
                    </p>
                  </div>
                  {onGoToDashboard && (
                    <button
                      onClick={onGoToDashboard}
                      className="px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition whitespace-nowrap cursor-pointer font-display"
                      style={{ background: 'var(--c-status-green-text)' }}
                    >
                      Enter Merchant Dashboard
                    </button>
                  )}
                </div>
              )}

              {data.status === 'rejected' && (
                <div className="p-5 rounded-xl border space-y-3" style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
                  <h3 className="font-bold text-base flex items-center gap-2 font-display" style={{ color: 'var(--c-status-red-text)' }}>
                    <IconClose className="w-5 h-5" style={{ color: 'var(--c-status-red-text)' }} />
                    <span>Application Not Approved</span>
                  </h3>
                  <p className="text-xs font-bold">Rejection Reason Provided by Administrator:</p>
                  <div className="p-4 rounded-xl text-xs italic font-medium border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                    "{data.rejection_reason || 'Application did not satisfy current onboarding requirements.'}"
                  </div>
                  <p className="text-xs pt-1" style={{ color: 'var(--c-muted)' }}>
                    If you believe this was an error or would like to update your submission details, please contact support at <a href="mailto:nnnnsachdeva@gmail.com" className="underline font-bold" style={{ color: 'var(--c-gold)' }}>nnnnsachdeva@gmail.com</a>.
                  </p>
                </div>
              )}

              {data.status === 'pending' && (
                <div className="p-5 rounded-xl border space-y-1" style={{ background: 'var(--c-status-amber-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-amber-text)' }}>
                  <h3 className="font-bold text-sm font-display">Verification in Progress</h3>
                  <p className="text-xs leading-relaxed" style={{ opacity: 0.9 }}>
                    Our compliance team is currently reviewing your merchant application. This verification step protects customers and platform integrity. You will automatically receive access once approved.
                  </p>
                </div>
              )}

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)' }}>
                <div>
                  <span className="font-semibold block uppercase tracking-wider text-[10px] font-display" style={{ color: 'var(--c-muted)' }}>
                    Application Reference ID
                  </span>
                  <span className="font-mono text-xs font-bold" style={{ color: 'var(--c-text)' }}>{data.id}</span>
                </div>
                <div>
                  <span className="font-semibold block uppercase tracking-wider text-[10px] font-display" style={{ color: 'var(--c-muted)' }}>
                    Submitted Date
                  </span>
                  <span className="font-bold" style={{ color: 'var(--c-text)' }}>
                    {new Date(data.submitted_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <span className="font-semibold block uppercase tracking-wider text-[10px] mb-0.5 font-display" style={{ color: 'var(--c-muted)' }}>
                    Business Justification
                  </span>
                  <span className="italic" style={{ color: 'var(--c-text)' }}>{data.reason}</span>
                </div>
              </div>
            </div>

            {/* Persistent Audit Timeline */}
            <div className="rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--c-border-soft)' }}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                    Audit Trail
                  </span>
                  <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>Persistent Application Timeline</h3>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full border font-mono" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
                  {data.timeline?.length || 0} Events Logged
                </span>
              </div>

              <div className="relative border-l-2 ml-3 space-y-6" style={{ borderColor: 'var(--c-timeline-line)' }}>
                {data.timeline && data.timeline.length > 0 ? (
                  data.timeline.map((event) => (
                    <div key={event.id} className="relative pl-6">
                      {/* Node Dot */}
                      <div
                        className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2"
                        style={{
                          background: event.event_type === 'APPROVED'
                            ? 'var(--c-status-green-text)'
                            : event.event_type === 'REJECTED'
                            ? 'var(--c-status-red-text)'
                            : 'var(--c-gold)',
                          borderColor: 'var(--c-surface)',
                        }}
                      />

                      <div className="p-4 rounded-xl space-y-1.5 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-display"
                            style={{
                              background: event.event_type === 'APPROVED'
                                ? 'var(--c-status-green-bg)'
                                : event.event_type === 'REJECTED'
                                ? 'var(--c-status-red-bg)'
                                : 'var(--c-status-amber-bg)',
                              color: event.event_type === 'APPROVED'
                                ? 'var(--c-status-green-text)'
                                : event.event_type === 'REJECTED'
                                ? 'var(--c-status-red-text)'
                                : 'var(--c-status-amber-text)',
                              borderColor: 'var(--c-border-soft)',
                            }}
                          >
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
                            {new Date(event.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <p className="text-xs font-medium" style={{ color: 'var(--c-text)' }}>
                          {event.description || 'Timeline event recorded'}
                        </p>

                        <div className="text-[10px] pt-1 flex items-center gap-2" style={{ color: 'var(--c-muted)' }}>
                          <span>
                            Actor Role: <strong className="uppercase" style={{ color: 'var(--c-text)' }}>{event.actor_role}</strong>
                          </span>
                          {event.actor_id && <span className="font-mono text-[9px]">({event.actor_id})</span>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs pl-4 italic" style={{ color: 'var(--c-muted)' }}>No timeline events recorded.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Universal Footer */}
      <Footer
        isAdmin={true}
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
