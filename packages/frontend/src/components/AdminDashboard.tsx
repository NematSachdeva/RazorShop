import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getApiUrl } from '../config/api';

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
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-black text-purple-400 tracking-tight">RAZOR</span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase tracking-widest">
                Platform Admin Portal
              </span>
            </div>
            <p className="text-xs text-slate-400">Merchant Onboarding Approval & Persistent Application Audit</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              className="px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700"
            >
              🔄 Refresh Data
            </button>
            {onLogout && (
              <button
                onClick={() => onLogout()}
                className="px-3.5 py-2 text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl transition border border-rose-800"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl text-sm font-medium flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-xs font-bold text-rose-400 hover:text-rose-200">Dismiss</button>
          </div>
        )}

        {actionSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 p-4 rounded-xl text-sm font-medium flex items-center justify-between">
            <span>✅ {actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-xs font-bold text-emerald-400 hover:text-emerald-200">Dismiss</button>
          </div>
        )}

        {/* Summary Stat Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Submissions</span>
              <span className="text-3xl font-black text-white mt-1 block">{summary.total_count}</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-800/60 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">Pending Approval</span>
              <span className="text-3xl font-black text-amber-400 mt-1 block">{summary.pending_count}</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-800/60 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider block">Approved Merchants</span>
              <span className="text-3xl font-black text-emerald-400 mt-1 block">{summary.approved_count}</span>
            </div>
            <div className="bg-rose-950/40 border border-rose-800/60 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider block">Rejected Applications</span>
              <span className="text-3xl font-black text-rose-400 mt-1 block">{summary.rejected_count}</span>
            </div>
          </div>
        )}

        {/* Main Applications Table Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-white uppercase tracking-wider">Merchant Applications</h2>
            {/* Filter Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-lg font-extrabold uppercase transition ${
                    statusFilter === filter
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm font-semibold">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No applications found matching filter "{statusFilter}".</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Business / Applicant</th>
                    <th className="py-3 px-4">Email / Contact</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-100 text-sm block break-words">{app.business_name}</span>
                        <span className="text-slate-400 text-[11px]">{app.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {app.email}
                        {app.phone && <span className="block text-[10px] text-slate-500 font-sans">{app.phone}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{new Date(app.submitted_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            app.status === 'approved'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : app.status === 'rejected'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
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
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 transition"
                        >
                          Review Detail
                        </button>
                        {app.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => handleApprove(app.id, e)}
                              disabled={submittingAction}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
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
                              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
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
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Application Review</span>
                  <h3 className="text-xl font-black text-white">{selectedApp.business_name}</h3>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-white font-extrabold text-xl">✕</button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-semibold">Applicant Name</span>
                    <span className="text-slate-200 font-bold">{selectedApp.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-semibold">Email</span>
                    <span className="text-slate-200 font-mono break-all">{selectedApp.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-semibold">Status</span>
                    <span className="font-bold text-slate-200 uppercase">{selectedApp.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-semibold">Submitted</span>
                    <span className="text-slate-200">{new Date(selectedApp.submitted_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block mb-1">Reason for Request</span>
                  <p className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-300 italic break-words">{selectedApp.reason}</p>
                </div>

                {selectedApp.rejection_reason && (
                  <div>
                    <span className="text-rose-400 font-bold uppercase text-[10px] tracking-wider block mb-1">Rejection Reason</span>
                    <p className="bg-rose-950/60 p-3.5 rounded-xl border border-rose-800 text-rose-200 break-words">{selectedApp.rejection_reason}</p>
                  </div>
                )}

                {/* Timeline Events in Detail Modal */}
                {selectedApp.timeline && selectedApp.timeline.length > 0 && (
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider block mb-2">Audit Log Timeline</span>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedApp.timeline.map((evt) => (
                        <div key={evt.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-bold text-purple-400 mr-2">[{evt.event_type}]</span>
                            <span className="text-slate-300">{evt.description}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(evt.created_at).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
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
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-extrabold transition"
                    >
                      Reject Application
                    </button>
                    <button
                      onClick={(e) => handleApprove(selectedApp.id, e)}
                      disabled={submittingAction}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition disabled:opacity-50"
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-lg font-black text-rose-400">Reject Application</h3>
              <p className="text-xs text-slate-300">
                Rejecting merchant application for <strong className="text-white">{selectedApp.business_name}</strong>. A mandatory reason must be provided to the applicant.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g., Incomplete business registration documents or non-compliant category."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setRejectionReasonInput('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => handleRejectSubmit(e)}
                  disabled={submittingAction || !rejectionReasonInput.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
