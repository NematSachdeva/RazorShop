/**
 * RecoveryCasesList Component
 * Lists seller recovery cases with status filtering, rich order & customer metadata, and pagination.
 * Redesigned using Figma theme tokens.
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return { bg: 'var(--c-status-green-bg)', text: 'var(--c-status-green-text)' };
      case 'in_progress':
        return { bg: 'var(--c-status-amber-bg)', text: 'var(--c-status-amber-text)' };
      case 'open':
        return { bg: 'var(--c-status-blue-bg)', text: 'var(--c-status-blue-text)' };
      case 'customer_declined':
        return { bg: 'var(--c-status-red-bg)', text: 'var(--c-status-red-text)' };
      default:
        return { bg: 'var(--c-surface2)', text: 'var(--c-muted)' };
    }
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
    <div className="space-y-6 font-sans">
      {/* Filters Header */}
      <div
        className="p-4 rounded-2xl border flex flex-wrap justify-between items-center gap-4 themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-muted)' }}>
            Filter Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-amber-500 font-display"
            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
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
          className="px-4 py-2 rounded-xl text-xs font-bold transition font-display cursor-pointer"
          style={{ background: 'var(--c-gold)', color: '#0a0908' }}
        >
          Refresh Cases
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl p-12 text-center border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Loading recovery cases...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl p-6 text-center border" style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border)', color: 'var(--c-status-red-text)' }}>
          <p className="font-bold text-sm mb-2 font-display">Failed to load recovery cases</p>
          <p className="text-xs mb-4">{error}</p>
          <button
            onClick={() => fetchCases()}
            className="px-4 py-2 rounded-xl text-xs font-bold font-display transition cursor-pointer"
            style={{ background: 'var(--c-gold)', color: '#0a0908' }}
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && cases.length === 0 && (
        <div className="rounded-2xl p-12 text-center border space-y-1" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <p className="font-bold text-lg font-display" style={{ color: 'var(--c-text)' }}>No recovery cases yet</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Recovery cases will automatically appear when payment failures occur.</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b font-bold font-display uppercase tracking-wider text-[10px]" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
                <tr>
                  <th className="py-3.5 px-4">ORDER</th>
                  <th className="py-3.5 px-4">CUSTOMER</th>
                  <th className="py-3.5 px-4 text-right">AMOUNT</th>
                  <th className="py-3.5 px-4">REASON</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-center">ATTEMPTS</th>
                  <th className="py-3.5 px-4 text-center">EMAIL</th>
                  <th className="py-3.5 px-4">CREATED</th>
                  <th className="py-3.5 px-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => {
                  const hasAttempts = caseItem.recovery_attempts > 0;
                  const failureReasonText = caseItem.payment_failure?.reason
                    ? caseItem.payment_failure.reason.replace(/_/g, ' ')
                    : 'Payment Failed';

                  const badge = getStatusBadge(caseItem.status);

                  return (
                    <tr key={caseItem.id} className="border-b last:border-b-0 transition" style={{ borderColor: 'var(--c-border-soft)' }}>
                      <td className="py-4 px-4 font-mono font-bold" style={{ color: 'var(--c-gold)' }}>
                        {caseItem.order?.order_number ? `${caseItem.order.order_number.split('-').pop() || caseItem.order.order_number}` : caseItem.order_id.substring(0, 8)}
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{caseItem.customer?.name || 'Customer'}</p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>{caseItem.customer?.email || 'No Email'}</p>
                      </td>
                      <td className="py-4 px-4 text-right font-bold font-display" style={{ color: 'var(--c-text)' }}>
                        {formatPrice(caseItem.order?.total_cents)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="capitalize font-medium" style={{ color: 'var(--c-muted)' }}>{failureReasonText}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-display uppercase"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {caseItem.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-medium font-mono" style={{ color: 'var(--c-muted)' }}>
                        {caseItem.recovery_attempts}/{caseItem.max_recovery_attempts}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-mono font-medium" style={{ color: hasAttempts ? 'var(--c-gold)' : 'var(--c-muted)' }}>
                          {hasAttempts ? 'dispatched' : 'pending'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-medium" style={{ color: 'var(--c-muted)' }}>{formatDate(caseItem.created_at)}</td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => onCaseSelected(caseItem.id)}
                          className="font-bold transition text-xs font-display cursor-pointer underline"
                          style={{ color: 'var(--c-gold)' }}
                        >
                          View
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
            <div className="flex justify-between items-center p-4 rounded-2xl border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
                Showing page {currentPage} of {totalPages} ({totalCount} total cases)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-bold font-display cursor-pointer disabled:opacity-30"
                  style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={currentPage >= totalPages}
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-bold font-display cursor-pointer disabled:opacity-30"
                  style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
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
