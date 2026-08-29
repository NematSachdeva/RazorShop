import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface RecoveryCaseDetailData {
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
  const [caseData, setCaseData] = useState<RecoveryCaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const data: RecoveryCaseDetailData = await response.json();
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetail();
  }, [caseId]);

  const handleSendRecoveryEmail = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const response = await fetch(getApiUrl(`/merchant/recovery-cases/${caseId}/trigger-email`), {
        method: 'POST',
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      const data = await response.json();
      if (!response.ok || !data.sent) {
        throw new Error(data.error || 'Failed to trigger recovery email');
      }

      setEmailStatus({
        type: 'success',
        message: `Recovery email sent successfully to ${data.recipient || caseData?.customer?.email || 'customer'}.`,
      });
      fetchCaseDetail();
    } catch (err) {
      setEmailStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error triggering recovery email',
      });
    } finally {
      setSendingEmail(false);
    }
  };

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
      in_progress: 'bg-amber-100 text-amber-800',
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

  const isResolved = caseData.status === 'resolved';
  const hasEmailAction = caseData.recovery_actions?.some((a) => a.action_type.includes('email'));

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">Recovery Case</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(caseData.status)}`}>
                {caseData.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-mono">Case ID: {caseData.id}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSendRecoveryEmail}
              disabled={sendingEmail || isResolved}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50 flex items-center gap-2"
            >
              <span>📧</span>
              <span>{sendingEmail ? 'Sending Email...' : 'Send Recovery Email'}</span>
            </button>
          </div>
        </div>

        {emailStatus && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold ${
              emailStatus.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {emailStatus.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Created</p>
            <p className="font-semibold text-xs text-gray-900">{formatDate(caseData.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Last Updated</p>
            <p className="font-semibold text-xs text-gray-900">{formatDate(caseData.updated_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Recovery Attempts</p>
            <p className="font-semibold text-xs text-gray-900">
              {caseData.recovery_attempts} / {caseData.max_recovery_attempts}
            </p>
          </div>
          {caseData.resolved_at && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Resolved At</p>
              <p className="font-semibold text-xs text-green-700">{formatDate(caseData.resolved_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recovery Journey Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Recovery Journey Lifecycle Timeline</h3>

        <div className="relative border-l-2 border-blue-200 ml-4 space-y-6 py-2">
          {/* Step 1: Order Created */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full bg-blue-600 border-4 border-white shadow" />
            <div>
              <p className="font-semibold text-sm text-gray-900">Order Created</p>
              <p className="text-xs text-gray-500">
                Order #{caseData.order?.order_number} ({formatPrice(caseData.order?.total_cents || 0)})
              </p>
              <span className="text-[10px] text-gray-400">
                {caseData.order?.created_at ? formatDate(caseData.order.created_at) : 'Completed'}
              </span>
            </div>
          </div>

          {/* Step 2: Payment Failed */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full bg-red-600 border-4 border-white shadow" />
            <div>
              <p className="font-semibold text-sm text-red-700">Payment Failed</p>
              <p className="text-xs text-gray-600">
                Reason: {caseData.payment_failure?.reason.replace(/_/g, ' ').toUpperCase() || 'Payment Exception'}
              </p>
              <span className="text-[10px] text-gray-400">
                {caseData.payment_failure?.detected_at ? formatDate(caseData.payment_failure.detected_at) : 'Detected'}
              </span>
            </div>
          </div>

          {/* Step 3: Recovery Case Created */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full bg-amber-500 border-4 border-white shadow" />
            <div>
              <p className="font-semibold text-sm text-gray-900">Recovery Case Created</p>
              <p className="text-xs text-gray-500">Autonomous recovery tracking initiated</p>
              <span className="text-[10px] text-gray-400">{formatDate(caseData.created_at)}</span>
            </div>
          </div>

          {/* Step 4: Email Sent */}
          <div className="relative pl-6">
            <div
              className={`absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow ${
                hasEmailAction ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
            <div>
              <p className={`font-semibold text-sm ${hasEmailAction ? 'text-gray-900' : 'text-gray-400'}`}>
                {hasEmailAction ? 'Recovery Email Dispatched' : 'Email Notification Pending'}
              </p>
              <p className="text-xs text-gray-500">Sent to customer: {caseData.customer?.email}</p>
            </div>
          </div>

          {/* Step 5: Final Resolution Status */}
          <div className="relative pl-6">
            <div
              className={`absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow ${
                isResolved ? 'bg-green-600' : 'bg-amber-400'
              }`}
            />
            <div>
              <p className={`font-semibold text-sm ${isResolved ? 'text-green-700' : 'text-amber-700'}`}>
                {isResolved ? 'Recovered & Payment Captured' : `Current Status: ${caseData.status.toUpperCase()}`}
              </p>
              {caseData.resolved_at && (
                <span className="text-[10px] text-gray-400">{formatDate(caseData.resolved_at)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Order Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Info */}
        {caseData.customer && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2">Customer Profile</h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500 block">Name</span>
                <span className="font-semibold text-gray-900">{caseData.customer.name}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Email</span>
                <span className="font-semibold text-gray-900">{caseData.customer.email}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Customer ID</span>
                <span className="font-mono text-gray-700">{caseData.customer.id}</span>
              </div>
            </div>
          </div>
        )}

        {/* Order Info */}
        {caseData.order && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2">Associated Order</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Number</span>
                <span className="font-semibold text-gray-900">#{caseData.order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-extrabold text-blue-600">{formatPrice(caseData.order.total_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order Status</span>
                <span className="font-semibold text-gray-800">{caseData.order.status}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recovery Actions History */}
      {caseData.recovery_actions && caseData.recovery_actions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900">Audit Log of Recovery Actions</h3>
          <div className="space-y-2">
            {caseData.recovery_actions.map((action, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 bg-gray-50 rounded-r-lg p-3 text-xs flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{action.action_type.replace(/_/g, ' ').toUpperCase()}</p>
                  {action.outcome && <p className="text-gray-600 mt-0.5">Outcome: {action.outcome}</p>}
                </div>
                <span className="text-gray-400">{formatDate(action.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
