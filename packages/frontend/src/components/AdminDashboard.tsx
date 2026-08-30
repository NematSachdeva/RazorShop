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
        <div className="pb-4 border-b border-gray-100">
          <div
            onClick={() => setStatusFilter('all')}
            className="cursor-pointer flex items-center gap-2 select-none"
            title="Admin Dashboard Home"
          >
            <span className="text-2xl font-black tracking-tight text-gray-900">
              Razor<span className="text-blue-600">Shop</span>
            </span>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-wider block mt-1.5 w-fit">
            Platform Admin Portal
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block px-3 mb-2">
            Admin Management
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left bg-blue-50 text-blue-700 shadow-xs border-l-4 border-blue-600"
          >
            <IconShield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Merchant Applications</span>
          </button>
        </nav>
      </div>

      {/* Bottom Navigation Utilities */}
      <div className="pt-6 border-t border-gray-100 space-y-3">
        <a
          href="mailto:nnnnsachdeva@gmail.com"
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          <IconInfo className="w-4 h-4 text-gray-400" />
          <span>Support Contact</span>
        </a>

        {onLogout && (
          <button
            onClick={() => onLogout()}
            className="w-full flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition"
          >
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex w-full font-sans text-gray-900">
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-white h-full z-10 shadow-2xl flex flex-col">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
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
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                <IconShield className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                  RazorShop Admin Portal
                </span>
                <h1 className="text-lg sm:text-xl font-black text-gray-900 mt-0.5">
                  Merchant Onboarding & Application Audit
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>

              {currentUser && (
                <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <IconUser className="w-4 h-4 text-gray-500" />
                  <div className="text-left">
                    <span className="text-xs font-extrabold text-gray-900 block leading-tight">
                      {currentUser.name || 'Admin User'}
                    </span>
                    <span className="text-[10px] text-gray-500 block leading-tight">
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
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl text-xs font-bold flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-xs font-extrabold text-rose-700 hover:text-rose-900 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center justify-between">
              <span>{actionSuccess}</span>
              <button
                onClick={() => setActionSuccess(null)}
                className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Summary Stat Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 border-l-4 border-blue-600 p-5 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Total Submissions
                </span>
                <span className="text-3xl font-black text-gray-900 mt-1 block">
                  {summary.total_count}
                </span>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 border-l-4 border-amber-500 p-5 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Pending Approval
                </span>
                <span className="text-3xl font-black text-amber-950 mt-1 block">
                  {summary.pending_count}
                </span>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 border-l-4 border-emerald-500 p-5 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Approved Merchants
                </span>
                <span className="text-3xl font-black text-emerald-950 mt-1 block">
                  {summary.approved_count}
                </span>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 border-l-4 border-rose-500 p-5 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                  Rejected Applications
                </span>
                <span className="text-3xl font-black text-rose-950 mt-1 block">
                  {summary.rejected_count}
                </span>
              </div>
            </div>
          )}

          {/* Main Applications Table Container */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                  Merchant Submissions
                </span>
                <h2 className="text-lg font-black text-gray-900 mt-0.5">
                  Applications Audit List
                </h2>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-wider transition ${
                      statusFilter === filter
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-500 text-xs font-semibold flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading merchant applications...</span>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No merchant applications found matching filter "{statusFilter}".
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3.5 px-4">Business / Applicant</th>
                      <th className="py-3.5 px-4">Email / Contact</th>
                      <th className="py-3.5 px-4">Submitted Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        className="hover:bg-gray-50 transition cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-900 text-sm block break-words">
                            {app.business_name}
                          </span>
                          <span className="text-gray-500 text-[11px] font-medium">{app.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-700">
                          {app.email}
                          {app.phone && (
                            <span className="block text-[10px] text-gray-500 font-sans">
                              {app.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {new Date(app.submitted_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : app.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
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
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold border border-gray-200 transition"
                          >
                            Review Detail
                          </button>
                          {app.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => handleApprove(app.id, e)}
                                disabled={submittingAction}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
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
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] font-sans"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      Application Review Audit
                    </span>
                    <h3 className="text-xl font-black text-gray-900">{selectedApp.business_name}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="text-gray-400 hover:text-gray-600 font-extrabold text-xl p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">
                        Applicant Name
                      </span>
                      <span className="text-gray-900 font-bold">{selectedApp.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">
                        Email Contact
                      </span>
                      <span className="text-gray-900 font-mono break-all">{selectedApp.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">
                        Status
                      </span>
                      <span className="font-bold text-gray-900 uppercase">{selectedApp.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">
                        Submitted Date
                      </span>
                      <span className="text-gray-900">
                        {new Date(selectedApp.submitted_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-700 font-bold uppercase text-[10px] tracking-wider block mb-1">
                      Reason for Request
                    </span>
                    <p className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-gray-800 italic break-words">
                      {selectedApp.reason}
                    </p>
                  </div>

                  {selectedApp.rejection_reason && (
                    <div>
                      <span className="text-rose-700 font-bold uppercase text-[10px] tracking-wider block mb-1">
                        Rejection Reason
                      </span>
                      <p className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 text-rose-900 break-words">
                        {selectedApp.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Audit Timeline */}
                  {selectedApp.timeline && selectedApp.timeline.length > 0 && (
                    <div>
                      <span className="text-gray-700 font-bold uppercase text-[10px] tracking-wider block mb-2">
                        Audit Log Timeline
                      </span>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {selectedApp.timeline.map((evt) => (
                          <div
                            key={evt.id}
                            className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-blue-700 mr-2">
                                [{evt.event_type}]
                              </span>
                              <span className="text-gray-800">{evt.description}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {new Date(evt.created_at).toLocaleTimeString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
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
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs"
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={(e) => handleApprove(selectedApp.id, e)}
                        disabled={submittingAction}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition disabled:opacity-50 shadow-xs"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans"
              >
                <h3 className="text-lg font-black text-rose-700">Reject Application</h3>
                <p className="text-xs text-gray-600">
                  Rejecting merchant application for{' '}
                  <strong className="text-gray-900">{selectedApp.business_name}</strong>. A mandatory reason must be provided to the applicant.
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="e.g., Incomplete business registration documents or non-compliant category."
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsRejectModalOpen(false);
                      setRejectionReasonInput('');
                    }}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => handleRejectSubmit(e)}
                    disabled={submittingAction || !rejectionReasonInput.trim()}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition disabled:opacity-50 shadow-xs"
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
