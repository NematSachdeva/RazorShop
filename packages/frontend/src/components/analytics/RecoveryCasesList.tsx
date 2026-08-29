/**
 * RecoveryCasesList Component
 * Lists recovery cases with filtering and pagination
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
      setCases(data.recovery_cases);
      setTotalCount(data.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN');
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="abandoned">Abandoned</option>
              <option value="customer_declined">Customer Declined</option>
            </select>
          </div>
          <button
            onClick={() => fetchCases()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading recovery cases...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded shadow mb-6">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Case ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Attempts</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm text-gray-900">
                      {caseItem.id.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${getStatusColor(
                          caseItem.status
                        )}`}
                      >
                        <span>{getStatusIcon(caseItem.status)}</span>
                        {caseItem.status.replace(/_/g, ' ').charAt(0).toUpperCase() +
                          caseItem.status.slice(1).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-gray-600">{caseItem.customer_id.substring(0, 8)}...</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-gray-900">
                        {caseItem.recovery_attempts}/{caseItem.max_recovery_attempts}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(caseItem.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onCaseSelected(caseItem.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setOffset((page - 1) * limit)}
                  className={`px-3 py-2 rounded ${
                    currentPage === page ? 'bg-blue-600 text-white' : 'border border-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && cases.length === 0 && (
        <div className="bg-gray-100 rounded p-8 text-center">
          <p className="text-gray-600">No recovery cases found</p>
        </div>
      )}

      {/* Stats */}
      {!loading && !error && totalCount > 0 && (
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">
            Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of {totalCount} recovery cases
          </p>
        </div>
      )}
    </div>
  );
}
