import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getApiUrl } from '../config/api';
import {
  IconShield,
  IconRefresh,
  IconUser,
  IconClose,
  IconInfo,
} from './common/Icons';
import Footer from './Footer';

interface TimelineEvent {
  id: string;
  event_type: 'APPLICATION_SUBMITTED' | 'APPROVED' | 'REJECTED';
  actor_id?: string;
  actor_role: string;
  description?: string;
  created_at: string;
}

interface Application {
  id: string;
  customer_id: string;
  email: string;
  name: string;
  phone?: string;
  business_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  reviewer_id?: string;
  rejection_reason?: string;
  timeline?: TimelineEvent[];
}

interface SummaryMetrics {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_count: number;
}

interface AdminDashboardProps {
  onLogout?: () => void;
  onNavigateToPath?: (path: string) => void;
}

export default function AdminDashboard({ onLogout, onNavigateToPath }: AdminDashboardProps) {
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

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

  const currentUser = authService.getUser();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isRejectModalOpen) {
          setIsRejectModalOpen(false);
          setRejectionReasonInput('');
        } else if (selectedApp) {
          setSelectedApp(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRejectModalOpen, selectedApp]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = authService.getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const summaryRes = await fetch(getApiUrl('/admin/summary'), { headers });
      if (!summaryRes.ok) throw new Error('Failed to fetch admin summary metrics');
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      const filterParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const appsRes = await fetch(getApiUrl(`/admin/applications${filterParam}`), { headers });
      if (!appsRes.ok) throw new Error('Failed to fetch merchant applications');
      const appsData = await appsRes.json();
      setApplications(appsData.applications || []);
    } catch (err: any) {
      setError(err.message || 'Error loading admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApprove = async (appId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSubmittingAction(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(getApiUrl(`/admin/applications/${appId}/approve`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to approve application');
      }

      setActionSuccess(`Application ${appId.slice(0, 8)}... successfully approved.`);
      setSelectedApp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Approval action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectSubmit = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedApp) return;
    if (!rejectionReasonInput.trim()) {
      setError('Please provide a mandatory rejection reason before rejecting.');
      return;
    }

    setSubmittingAction(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(getApiUrl(`/admin/applications/${selectedApp.id}/reject`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejection_reason: rejectionReasonInput.trim() }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to reject application');
      }

      setActionSuccess(`Application for ${selectedApp.business_name} rejected.`);
      setIsRejectModalOpen(false);
      setRejectionReasonInput('');
      setSelectedApp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Rejection action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-5 font-sans">
      <div className="space-y-6">
        {/* Brand Logo Header */}
        <div className="pb-4 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
          <div
            onClick={() => setStatusFilter('all')}
            className="cursor-pointer flex items-center gap-2 select-none"
            title="Admin Dashboard Home"
          >
            <span className="text-2xl font-bold tracking-tight font-display" style={{ color: 'var(--c-text)' }}>
              Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider block mt-1.5 w-fit font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-border-soft)' }}>
            Platform Admin Portal
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest block px-3 mb-2 font-display" style={{ color: 'var(--c-muted)' }}>
            Admin Management
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left border-l-4 font-display cursor-pointer"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-gold)', borderColor: 'var(--c-gold)' }}
          >
            <IconShield className="w-4 h-4 shrink-0" style={{ color: 'var(--c-gold)' }} />
            <span>Merchant Applications</span>
          </button>
        </nav>
      </div>

      {/* Bottom Navigation Utilities */}
      <div className="pt-6 border-t space-y-3" style={{ borderColor: 'var(--c-border-soft)' }}>
        <a
          href="mailto:nnnnsachdeva@gmail.com"
          className="flex items-center gap-2 text-xs font-semibold transition px-3 py-1.5 rounded-lg font-display"
          style={{ color: 'var(--c-muted)' }}
        >
          <IconInfo className="w-4 h-4" style={{ color: 'var(--c-muted)' }} />
          <span>Support Contact</span>
        </a>

        {onLogout && (
          <button
            onClick={() => onLogout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition font-display cursor-pointer"
            style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}
          >
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden lg:flex w-64 border-r shrink-0 sticky top-0 h-screen overflow-y-auto" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 h-full z-10 shadow-2xl flex flex-col" style={{ background: 'var(--c-surface)' }}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1"
              style={{ color: 'var(--c-muted)' }}
            >
              <IconClose className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Workspace Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 shadow-xs themed" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border"
                style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
              >
                <IconShield className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                  RazorShop Admin Portal
                </span>
                <h1 className="text-lg sm:text-xl font-bold mt-0.5 font-display" style={{ color: 'var(--c-text)' }}>
                  Seller Onboarding & Application Audit
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                onClick={handleToggleTheme}
                className="p-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-sm"
                style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}
                title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {isLightMode ? '🌙' : '☀️'}
              </button>

              <button
                onClick={() => loadData()}
                disabled={loading}
                className="px-3.5 py-2 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer font-display"
                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
              >
                <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>

              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                  <IconUser className="w-4 h-4 text-amber-500" />
                  <div className="text-left">
                    <span className="text-xs font-bold block leading-tight font-display" style={{ color: 'var(--c-text)' }}>
                      {currentUser.name || 'Admin User'}
                    </span>
                    <span className="text-[10px] block leading-tight" style={{ color: 'var(--c-muted)' }}>
                      Platform Administrator
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Body Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Feedback Alerts */}
          {error && (
            <div className="p-4 rounded-2xl text-xs font-bold flex items-center justify-between border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-xs font-extrabold underline cursor-pointer"
                style={{ color: 'var(--c-status-red-text)' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {actionSuccess && (
            <div className="p-4 rounded-2xl text-xs font-bold flex items-center justify-between border" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', borderColor: 'var(--c-border)' }}>
              <span>{actionSuccess}</span>
              <button
                onClick={() => setActionSuccess(null)}
                className="text-xs font-extrabold underline cursor-pointer"
                style={{ color: 'var(--c-status-green-text)' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Summary Stat Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-muted)' }}>
                  Total Submissions
                </span>
                <span className="text-3xl font-bold mt-1 block font-display" style={{ color: 'var(--c-text)' }}>
                  {summary.total_count}
                </span>
              </div>

              <div className="p-5 rounded-2xl border shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-status-amber-text)' }}>
                  Pending Approval
                </span>
                <span className="text-3xl font-bold mt-1 block font-display" style={{ color: 'var(--c-status-amber-text)' }}>
                  {summary.pending_count}
                </span>
              </div>

              <div className="p-5 rounded-2xl border shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-status-green-text)' }}>
                  Approved Sellers
                </span>
                <span className="text-3xl font-bold mt-1 block font-display" style={{ color: 'var(--c-status-green-text)' }}>
                  {summary.approved_count}
                </span>
              </div>

              <div className="p-5 rounded-2xl border shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-status-red-text)' }}>
                  Rejected Applications
                </span>
                <span className="text-3xl font-bold mt-1 block font-display" style={{ color: 'var(--c-status-red-text)' }}>
                  {summary.rejected_count}
                </span>
              </div>
            </div>
          )}

          {/* Main Applications Table Container */}
          <div className="rounded-2xl border p-6 shadow-xs space-y-4 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--c-border)' }}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                  Seller Applications
                </span>
                <h2 className="text-lg font-bold mt-0.5 font-display" style={{ color: 'var(--c-text)' }}>
                  Applications Audit List
                </h2>
              </div>

              {/* Filter Tabs */}
              <div className="flex p-1 rounded-xl border text-xs" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className="px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition cursor-pointer font-display"
                    style={{
                      background: statusFilter === filter ? 'var(--c-gold)' : 'transparent',
                      color: statusFilter === filter ? '#0a0908' : 'var(--c-muted)',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-xs font-semibold flex flex-col items-center gap-2" style={{ color: 'var(--c-muted)' }}>
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--c-gold)', borderTopColor: 'transparent' }} />
                <span>Loading seller applications...</span>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-16 text-xs rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
                No seller applications found matching filter "{statusFilter}".
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--c-border-soft)' }}>
                <table className="w-full text-left text-xs font-sans">
                  <thead className="uppercase text-[10px] font-extrabold tracking-wider border-b font-display" style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)', borderColor: 'var(--c-border-soft)' }}>
                    <tr>
                      <th className="py-3.5 px-4">Business / Applicant</th>
                      <th className="py-3.5 px-4">Email / Contact</th>
                      <th className="py-3.5 px-4">Submitted Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium" style={{ borderColor: 'var(--c-border-soft)' }}>
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        className="transition cursor-pointer"
                        style={{ borderColor: 'var(--c-border-soft)' }}
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-sm block break-words font-display" style={{ color: 'var(--c-text)' }}>
                            {app.business_name}
                          </span>
                          <span className="text-[11px] font-medium" style={{ color: 'var(--c-muted)' }}>{app.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono" style={{ color: 'var(--c-text)' }}>
                          {app.email}
                          {app.phone && (
                            <span className="block text-[10px] font-sans" style={{ color: 'var(--c-muted)' }}>
                              {app.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4" style={{ color: 'var(--c-muted)' }}>
                          {new Date(app.submitted_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border font-display"
                            style={{
                              background: app.status === 'approved'
                                ? 'var(--c-status-green-bg)'
                                : app.status === 'rejected'
                                ? 'var(--c-status-red-bg)'
                                : 'var(--c-status-amber-bg)',
                              color: app.status === 'approved'
                                ? 'var(--c-status-green-text)'
                                : app.status === 'rejected'
                                ? 'var(--c-status-red-text)'
                                : 'var(--c-status-amber-text)',
                              borderColor: 'var(--c-border-soft)',
                            }}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApp(app);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer font-display"
                            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)', borderColor: 'var(--c-border)' }}
                          >
                            Review Detail
                          </button>
                          {app.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => handleApprove(app.id, e)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50 cursor-pointer font-display"
                                style={{ background: 'var(--c-status-green-text)' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApp(app);
                                  setIsRejectModalOpen(true);
                                }}
                                disabled={submittingAction}
                                className="px-3 py-1.5 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50 cursor-pointer font-display"
                                style={{ background: 'var(--c-status-red-text)' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Application Detail Modal */}
          {selectedApp && !isRejectModalOpen && (
            <div
              onClick={() => setSelectedApp(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn font-sans"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] border font-sans themed"
                style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
              >
                <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-gold)' }}>
                      Application Review Audit
                    </span>
                    <h3 className="text-xl font-bold font-display" style={{ color: 'var(--c-text)' }}>{selectedApp.business_name}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="p-1.5 rounded-full transition cursor-pointer font-bold"
                    style={{ color: 'var(--c-muted)', background: 'var(--c-surface2)' }}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)' }}>
                    <div>
                      <span className="uppercase tracking-wider text-[10px] block font-semibold" style={{ color: 'var(--c-muted)' }}>
                        Applicant Name
                      </span>
                      <span className="font-bold" style={{ color: 'var(--c-text)' }}>{selectedApp.name}</span>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider text-[10px] block font-semibold" style={{ color: 'var(--c-muted)' }}>
                        Email Contact
                      </span>
                      <span className="font-mono break-all font-bold" style={{ color: 'var(--c-text)' }}>{selectedApp.email}</span>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider text-[10px] block font-semibold" style={{ color: 'var(--c-muted)' }}>
                        Status
                      </span>
                      <span className="font-bold uppercase" style={{ color: selectedApp.status === 'approved' ? 'var(--c-status-green-text)' : selectedApp.status === 'rejected' ? 'var(--c-status-red-text)' : 'var(--c-status-amber-text)' }}>{selectedApp.status}</span>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider text-[10px] block font-semibold" style={{ color: 'var(--c-muted)' }}>
                        Submitted Date
                      </span>
                      <span className="font-bold" style={{ color: 'var(--c-text)' }}>
                        {new Date(selectedApp.submitted_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold uppercase text-[10px] tracking-wider block mb-1 font-display" style={{ color: 'var(--c-muted)' }}>
                      Reason for Request
                    </span>
                    <p className="p-3.5 rounded-xl border italic break-words" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                      {selectedApp.reason}
                    </p>
                  </div>

                  {selectedApp.rejection_reason && (
                    <div>
                      <span className="font-bold uppercase text-[10px] tracking-wider block mb-1 font-display" style={{ color: 'var(--c-status-red-text)' }}>
                        Rejection Reason
                      </span>
                      <p className="p-3.5 rounded-xl border break-words" style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
                        {selectedApp.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Audit Timeline */}
                  {selectedApp.timeline && selectedApp.timeline.length > 0 && (
                    <div>
                      <span className="font-bold uppercase text-[10px] tracking-wider block mb-2 font-display" style={{ color: 'var(--c-muted)' }}>
                        Audit Log Timeline
                      </span>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {selectedApp.timeline.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-2.5 rounded-xl border flex items-center justify-between text-[11px]"
                            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)' }}
                          >
                            <div>
                              <span className="font-bold mr-2 font-display" style={{ color: evt.event_type === 'APPROVED' ? 'var(--c-status-green-text)' : evt.event_type === 'REJECTED' ? 'var(--c-status-red-text)' : 'var(--c-gold)' }}>
                                [{evt.event_type}]
                              </span>
                              <span style={{ color: 'var(--c-text)' }}>{evt.description}</span>
                            </div>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                              {new Date(evt.created_at).toLocaleTimeString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  >
                    Close
                  </button>
                  {selectedApp.status === 'pending' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsRejectModalOpen(true);
                        }}
                        className="px-4 py-2 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer font-display"
                        style={{ background: 'var(--c-status-red-text)' }}
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={(e) => handleApprove(selectedApp.id, e)}
                        disabled={submittingAction}
                        className="px-4 py-2 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-xs cursor-pointer font-display"
                        style={{ background: 'var(--c-status-green-text)' }}
                      >
                        Approve Application
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mandatory Rejection Reason Modal */}
          {isRejectModalOpen && selectedApp && (
            <div
              onClick={() => {
                setIsRejectModalOpen(false);
                setRejectionReasonInput('');
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn font-sans"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border font-sans themed"
                style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
              >
                <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-status-red-text)' }}>Reject Application</h3>
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  Rejecting merchant application for{' '}
                  <strong style={{ color: 'var(--c-text)' }}>{selectedApp.business_name}</strong>. A mandatory reason must be provided to the applicant.
                </p>

                <div>
                  <label className="block text-xs font-bold mb-1 uppercase tracking-wider font-display" style={{ color: 'var(--c-muted)' }}>
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="e.g., Incomplete business registration documents or non-compliant category."
                    rows={4}
                    className="w-full rounded-xl p-3 text-xs focus:outline-none font-medium border"
                    style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsRejectModalOpen(false);
                      setRejectionReasonInput('');
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => handleRejectSubmit(e)}
                    disabled={submittingAction || !rejectionReasonInput.trim()}
                    className="px-5 py-2 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 shadow-xs cursor-pointer font-display"
                    style={{ background: 'var(--c-status-red-text)' }}
                  >
                    {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <Footer
          isAdmin={true}
          onNavigateToStore={() => setStatusFilter('all')}
          onNavigateToOrders={() => setStatusFilter('pending')}
          onOpenCart={() => setStatusFilter('approved')}
          onNavigateToApplications={() => setStatusFilter('all')}
          onNavigateToPending={() => setStatusFilter('pending')}
          onNavigateToApproved={() => setStatusFilter('approved')}
          onOpenPrivacy={() => (onNavigateToPath ? onNavigateToPath('/privacy') : (window.location.href = '/privacy'))}
          onOpenTerms={() => (onNavigateToPath ? onNavigateToPath('/terms') : (window.location.href = '/terms'))}
          onOpenContact={() => (onNavigateToPath ? onNavigateToPath('/support') : (window.location.href = '/support'))}
          onOpenApiStatus={() => (onNavigateToPath ? onNavigateToPath('/status') : (window.location.href = '/status'))}
        />
      </div>
    </div>
  );
}
