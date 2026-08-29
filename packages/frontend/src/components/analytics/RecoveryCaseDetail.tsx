/**
 * RecoveryCaseDetail Component
 * Displays detailed information for a recovery case
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface RecoveryCaseDetail {
  id: string;
  status: string;
  recovery_attempts: number;
  max_recovery_attempts: number;
  recovery_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  order?: {
    id: string;
    order_number: string;
    total_cents: number;
    status: string;
    created_at: string;
  };
  customer?: {
    id: string;
    email: string;
    name: string;
  };
  payment_failure?: {
    id: string;
    reason: string;
    failure_count: number;
    detected_at: string;
    error_message?: string;
  };
  recovery_actions?: Array<{
    id: string;
    action_type: string;
    created_at: string;
    outcome?: string;
  }>;
  agent_decisions?: Array<{
    id: string;
    decision: string;
    explanation: string;
    confidence_score: number;
    created_at: string;
  }>;
}

interface RecoveryCaseDetailProps {
  caseId: string;
}

export default function RecoveryCaseDetail({ caseId }: RecoveryCaseDetailProps) {
  const [caseData, setCaseData] = useState<RecoveryCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCaseDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(getApiUrl(`/merchant/recovery-cases/${caseId}`), {
          headers: {
            ...authService.getAuthHeader(),
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load recovery case details');
        }

        const data: RecoveryCaseDetail = await response.json();
        setCaseData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetail();
  }, [caseId]);

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN');
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      abandoned: 'bg-gray-100 text-gray-800',
      customer_declined: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading recovery case details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!caseData) {
    return <div className="text-center py-12"><p className="text-gray-600">Recovery case not found</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="bg-white rounded shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Recovery Case</h2>
            <p className="text-sm text-gray-600 font-mono">{caseData.id}</p>
          </div>
          <span className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(caseData.status)}`}>
            {caseData.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Created</p>
            <p className="font-semibold text-gray-900">{formatDate(caseData.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Last Updated</p>
            <p className="font-semibold text-gray-900">{formatDate(caseData.updated_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Recovery Attempts</p>
            <p className="font-semibold text-gray-900">{caseData.recovery_attempts}/{caseData.max_recovery_attempts}</p>
          </div>
          {caseData.resolved_at && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Resolved</p>
              <p className="font-semibold text-gray-900">{formatDate(caseData.resolved_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Information */}
      {caseData.customer && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Name</p>
              <p className="font-semibold text-gray-900">{caseData.customer.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-gray-900">{caseData.customer.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Customer ID</p>
              <p className="font-mono text-sm text-gray-900">{caseData.customer.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Order Information */}
      {caseData.order && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Order Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Order Number</p>
              <p className="font-semibold text-gray-900">{caseData.order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Order Amount</p>
              <p className="font-semibold text-blue-600">{formatPrice(caseData.order.total_cents)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Order Status</p>
              <p className="font-semibold text-gray-900">{caseData.order.status}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs text-gray-600 mb-1">Order ID</p>
              <p className="font-mono text-sm text-gray-900">{caseData.order.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Failure Information */}
      {caseData.payment_failure && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Failure Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Failure Reason</p>
              <p className="font-semibold text-gray-900">{caseData.payment_failure.reason.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Failure Count</p>
              <p className="font-semibold text-gray-900">{caseData.payment_failure.failure_count}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1">Detected At</p>
              <p className="font-semibold text-gray-900">{formatDate(caseData.payment_failure.detected_at)}</p>
            </div>
            {caseData.payment_failure.error_message && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 mb-1">Error Message</p>
                <p className="font-mono text-sm text-red-600 bg-red-50 p-2 rounded">{caseData.payment_failure.error_message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recovery Actions */}
      {caseData.recovery_actions && caseData.recovery_actions.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recovery Actions</h3>
          <div className="space-y-2">
            {caseData.recovery_actions.map((action, idx) => (
              <div key={idx} className="border-l-4 border-blue-400 pl-4 py-2">
                <p className="font-semibold text-gray-900">{action.action_type.replace(/_/g, ' ').toUpperCase()}</p>
                <p className="text-sm text-gray-600">{formatDate(action.created_at)}</p>
                {action.outcome && <p className="text-xs text-gray-500 mt-1">Outcome: {action.outcome}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Decisions */}
      {caseData.agent_decisions && caseData.agent_decisions.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Agent Decisions</h3>
          <div className="space-y-3">
            {caseData.agent_decisions.map((decision, idx) => (
              <div key={idx} className="border border-gray-200 rounded p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-900">{decision.decision.toUpperCase()}</p>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {decision.confidence_score}% confidence
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{decision.explanation}</p>
                <p className="text-xs text-gray-500">{formatDate(decision.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery Notes */}
      {caseData.recovery_notes && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recovery Notes</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-gray-700">{caseData.recovery_notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
