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

  if (loading) {
    return (
      <div className="rounded-2xl border p-12 text-center shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Loading recovery case details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border p-6 shadow-xs themed" style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border)', color: 'var(--c-status-red-text)' }}>
        <p className="font-bold text-sm font-display">{error}</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="rounded-2xl border p-12 text-center shadow-xs themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Recovery case not found</p>
      </div>
    );
  }

  const isResolved = caseData.status === 'resolved';
  const hasEmailAction = caseData.recovery_actions?.some((a) => a.action_type.includes('email'));

  return (
    <div className="space-y-6 font-sans">
      {/* Case Header */}
      <div
        className="rounded-2xl border p-6 space-y-4 shadow-xs themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>Recovery Case Detail</h2>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold font-display uppercase tracking-wider border" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', borderColor: 'var(--c-border)' }}>
                {caseData.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--c-muted)' }}>Case ID: {caseData.id}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSendRecoveryEmail}
              disabled={sendingEmail || isResolved}
              className="px-4 py-2 rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-2 transition cursor-pointer font-display"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              <span>{sendingEmail ? 'Sending Email...' : 'Send Recovery Email'}</span>
            </button>
          </div>
        </div>

        {emailStatus && (
          <div
            className="p-3 rounded-xl text-xs font-semibold border"
            style={{
              background: emailStatus.type === 'success' ? 'var(--c-status-green-bg)' : 'var(--c-status-red-bg)',
              color: emailStatus.type === 'success' ? 'var(--c-status-green-text)' : 'var(--c-status-red-text)',
              borderColor: 'var(--c-border)',
            }}
          >
            {emailStatus.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--c-muted)' }}>Created</p>
            <p className="font-bold text-xs font-display" style={{ color: 'var(--c-text)' }}>{formatDate(caseData.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--c-muted)' }}>Last Updated</p>
            <p className="font-bold text-xs font-display" style={{ color: 'var(--c-text)' }}>{formatDate(caseData.updated_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--c-muted)' }}>Recovery Attempts</p>
            <p className="font-bold text-xs font-display" style={{ color: 'var(--c-text)' }}>
              {caseData.recovery_attempts} / {caseData.max_recovery_attempts}
            </p>
          </div>
          {caseData.resolved_at && (
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--c-muted)' }}>Resolved At</p>
              <p className="font-bold text-xs font-display" style={{ color: 'var(--c-status-green-text)' }}>{formatDate(caseData.resolved_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recovery Journey Timeline */}
      <div
        className="rounded-2xl border p-6 space-y-4 shadow-xs themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <h3 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>Recovery Journey Lifecycle Timeline</h3>

        <div className="relative border-l-2 ml-4 space-y-6 py-2" style={{ borderColor: 'var(--c-border)' }}>
          {/* Step 1: Order Created */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-black" style={{ background: 'var(--c-gold)' }} />
            <div>
              <p className="font-bold text-sm font-display" style={{ color: 'var(--c-text)' }}>Order Created</p>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                Order #{caseData.order?.order_number} ({formatPrice(caseData.order?.total_cents || 0)})
              </p>
              <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                {caseData.order?.created_at ? formatDate(caseData.order.created_at) : 'Completed'}
              </span>
            </div>
          </div>

          {/* Step 2: Payment Failed */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-black" style={{ background: 'var(--c-status-red-text)' }} />
            <div>
              <p className="font-bold text-sm font-display" style={{ color: 'var(--c-status-red-text)' }}>Payment Failed</p>
              <p className="text-xs" style={{ color: 'var(--c-text-dim)' }}>
                Reason: {caseData.payment_failure?.reason.replace(/_/g, ' ').toUpperCase() || 'Payment Exception'}
              </p>
              <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                {caseData.payment_failure?.detected_at ? formatDate(caseData.payment_failure.detected_at) : 'Detected'}
              </span>
            </div>
          </div>

          {/* Step 3: Recovery Case Created */}
          <div className="relative pl-6">
            <div className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-black" style={{ background: 'var(--c-gold)' }} />
            <div>
              <p className="font-bold text-sm font-display" style={{ color: 'var(--c-text)' }}>Recovery Case Created</p>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Autonomous recovery tracking initiated</p>
              <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{formatDate(caseData.created_at)}</span>
            </div>
          </div>

          {/* Step 4: Email Sent */}
          <div className="relative pl-6">
            <div
              className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-black"
              style={{ background: hasEmailAction ? 'var(--c-gold)' : 'var(--c-border)' }}
            />
            <div>
              <p className="font-bold text-sm font-display" style={{ color: hasEmailAction ? 'var(--c-text)' : 'var(--c-muted)' }}>
                {hasEmailAction ? 'Recovery Email Dispatched' : 'Email Notification Pending'}
              </p>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Sent to customer: {caseData.customer?.email}</p>
            </div>
          </div>

          {/* Step 5: Final Resolution Status */}
          <div className="relative pl-6">
            <div
              className="absolute -left-2.5 top-1.5 w-5 h-5 rounded-full border-4 border-black"
              style={{ background: isResolved ? 'var(--c-status-green-text)' : 'var(--c-gold)' }}
            />
            <div>
              <p className="font-bold text-sm font-display" style={{ color: isResolved ? 'var(--c-status-green-text)' : 'var(--c-gold)' }}>
                {isResolved ? 'Recovered & Payment Captured' : `Current Status: ${caseData.status.toUpperCase()}`}
              </p>
              {caseData.resolved_at && (
                <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{formatDate(caseData.resolved_at)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Order Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Info */}
        {caseData.customer && (
          <div
            className="rounded-2xl border p-6 space-y-3 shadow-xs themed"
            style={{
              background: 'var(--c-surface)',
              borderColor: 'var(--c-border)',
              color: 'var(--c-text)',
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider border-b pb-2 font-display" style={{ color: 'var(--c-gold)', borderColor: 'var(--c-border)' }}>Customer Profile</h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="block font-medium" style={{ color: 'var(--c-muted)' }}>Name</span>
                <span className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{caseData.customer.name}</span>
              </div>
              <div>
                <span className="block font-medium" style={{ color: 'var(--c-muted)' }}>Email</span>
                <span className="font-bold font-mono" style={{ color: 'var(--c-text)' }}>{caseData.customer.email}</span>
              </div>
              <div>
                <span className="block font-medium" style={{ color: 'var(--c-muted)' }}>Customer ID</span>
                <span className="font-mono" style={{ color: 'var(--c-muted)' }}>{caseData.customer.id}</span>
              </div>
            </div>
          </div>
        )}

        {/* Order Info */}
        {caseData.order && (
          <div
            className="rounded-2xl border p-6 space-y-3 shadow-xs themed"
            style={{
              background: 'var(--c-surface)',
              borderColor: 'var(--c-border)',
              color: 'var(--c-text)',
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider border-b pb-2 font-display" style={{ color: 'var(--c-gold)', borderColor: 'var(--c-border)' }}>Associated Order</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--c-muted)' }}>Order Number</span>
                <span className="font-bold font-mono" style={{ color: 'var(--c-gold)' }}>#{caseData.order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--c-muted)' }}>Total Amount</span>
                <span className="font-extrabold font-display text-base" style={{ color: 'var(--c-text)' }}>{formatPrice(caseData.order.total_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--c-muted)' }}>Order Status</span>
                <span className="font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>{caseData.order.status}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recovery Actions History */}
      {caseData.recovery_actions && caseData.recovery_actions.length > 0 && (
        <div
          className="rounded-2xl border p-6 space-y-4 shadow-xs themed"
          style={{
            background: 'var(--c-surface)',
            borderColor: 'var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)' }}>Audit Log of Recovery Actions</h3>
          <div className="space-y-2">
            {caseData.recovery_actions.map((action, idx) => (
              <div key={idx} className="border-l-4 rounded-r-xl p-3 text-xs flex justify-between items-center" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-gold)' }}>
                <div>
                  <p className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{action.action_type.replace(/_/g, ' ').toUpperCase()}</p>
                  {action.outcome && <p className="mt-0.5" style={{ color: 'var(--c-muted)' }}>Outcome: {action.outcome}</p>}
                </div>
                <span className="font-mono text-[10px]" style={{ color: 'var(--c-muted)' }}>{formatDate(action.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
