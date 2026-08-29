/**
 * RecoveryCasesList Component
 * Lists merchant recovery cases with status filtering, rich order & customer metadata, and pagination.
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface RecoveryCase {
  id: string;
  status: 'open' | 'in_progress' | 'resolved' | 'abandoned' | 'customer_declined';
  recovery_attempts: number;
  max_recovery_attempts: number;
  created_at: string;
  updated_at: string;
  customer_id: string;
  order_id: string;
  order?: {
    order_number: string;
    total_cents: number;
    status: string;
  };
  customer?: {
    name: string;
    email: string;
  };
  payment_failure?: {
    reason: string;
  };
}

interface RecoveryCasesListProps {
  onCaseSelected: (caseId: string) => void;
}

export default function RecoveryCasesList({ onCaseSelected }: RecoveryCasesListProps) {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (statusFilter) {
        query.append('status', statusFilter);
      }

      const response = await fetch(getApiUrl(`/merchant/recovery-cases?${query}`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load recovery cases');
      }

      const data = await response.json();
      setCases(data.recovery_cases || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading recovery cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter, offset]);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      open: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      resolved: 'bg-green-100 text-green-800 border-green-300',
      abandoned: 'bg-gray-100 text-gray-800 border-gray-300',
      customer_declined: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: string } = {
      open: '📥',
      in_progress: '⏳',
      resolved: '✅',
      abandoned: '❌',
      customer_declined: '🚫',
    };
    return icons[status] || '❓';
  };

  const formatPrice = (cents?: number) => {
    if (cents === undefined || cents === null) return '₹0.00';
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
          >
            <option value="">All Recovery Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="abandoned">Abandoned</option>
            <option value="customer_declined">Customer Declined</option>
          </select>
        </div>

        <button
          onClick={() => fetchCases()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
        >
          🔄 Refresh Cases
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
          <p className="text-gray-600 font-medium">Loading merchant recovery cases...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-bold mb-2">Failed to load recovery cases</p>
          <p className="text-xs text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchCases()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && cases.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
          <p className="text-gray-700 font-bold text-lg mb-1">No recovery cases yet</p>
          <p className="text-xs text-gray-500">Recovery cases will automatically appear when payment failures occur.</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Order Number</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4 text-right">Order Amount</th>
                  <th className="py-3.5 px-4">Failure Reason</th>
                  <th className="py-3.5 px-4">Recovery Status</th>
                  <th className="py-3.5 px-4 text-center">Attempts</th>
                  <th className="py-3.5 px-4 text-center">Email Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((caseItem) => {
                  const hasAttempts = caseItem.recovery_attempts > 0;
                  const failureReasonText = caseItem.payment_failure?.reason
                    ? caseItem.payment_failure.reason.replace(/_/g, ' ')
                    : 'payment failure';

                  return (
                    <tr key={caseItem.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                        #{caseItem.order?.order_number || caseItem.order_id.substring(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-gray-900">{caseItem.customer?.name || 'Customer'}</p>
                        <p className="text-[11px] text-gray-500 font-mono">{caseItem.customer?.email || 'No Email'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                        {formatPrice(caseItem.order?.total_cents)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize text-gray-700 font-medium">{failureReasonText}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${getStatusColor(
                            caseItem.status
                          )}`}
                        >
                          <span>{getStatusIcon(caseItem.status)}</span>
                          {caseItem.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-900">
                        {caseItem.recovery_attempts} / {caseItem.max_recovery_attempts}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            hasAttempts
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {hasAttempts ? 'Dispatched' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">{formatDate(caseItem.created_at)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onCaseSelected(caseItem.id)}
                          className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition-all text-xs"
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-600 font-medium">
                Showing page {currentPage} of {totalPages} ({totalCount} total cases)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
