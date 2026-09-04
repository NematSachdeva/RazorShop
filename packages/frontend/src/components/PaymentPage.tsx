import { useEffect, useState, useRef } from 'react';
import { getApiUrl } from '../config/api';
import PaymentStatus from './PaymentStatus';
import { IconClose } from './common/Icons';

interface PaymentPageProps {
  orderId: string;
  amountCents: number;
  onPaymentComplete: (status: 'success' | 'failed' | 'cancelled') => void;
  onCancel: () => void;
}

interface RazorpayCheckout {
  open: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: {
      new (options: RazorpayOptions): RazorpayCheckout;
    };
  }
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    email?: string;
    contact?: string;
  };
  theme?: {
    color: string;
  };
  modal?: {
    ondismiss: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error('Razorpay object not found after script load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Razorpay Checkout script'));
    };

    document.body.appendChild(script);
  });
}

export default function PaymentPage({
  orderId,
  amountCents,
  onPaymentComplete,
  onCancel,
}: PaymentPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    'loading' | 'ready' | 'processing' | 'verifying' | 'complete' | 'failed' | 'cancelled'
  >('loading');
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const initStartedRef = useRef(false);
  const hasReportedFailureRef = useRef(false);
  const reportedPaymentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && paymentStatus !== 'processing' && paymentStatus !== 'verifying') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paymentStatus, onCancel]);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initPayment = async () => {
      try {
        setPaymentStatus('loading');
        await loadRazorpayScript();
        setScriptLoaded(true);

        const response = await fetch(getApiUrl('/payments/create'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create payment');
        }

        const paymentData = await response.json();
        setRazorpayOrderId(paymentData.razorpay_order_id);
        setRazorpayKeyId(paymentData.razorpay_key_id);
        setPaymentStatus('ready');
      } catch (err) {
        console.error('[PaymentPage] Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        setPaymentStatus('failed');
      }
    };

    initPayment();
  }, [orderId]);

  useEffect(() => {
    if (paymentStatus === 'ready' && scriptLoaded && razorpayOrderId && razorpayKeyId) {
      handleOpenRazorpay();
    }
  }, [paymentStatus, scriptLoaded, razorpayOrderId, razorpayKeyId]);

  const handleOpenRazorpay = async () => {
    if (!scriptLoaded || !window.Razorpay || !razorpayOrderId || !razorpayKeyId) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setPaymentStatus('processing');
    setError(null);

    try {
      const options: RazorpayOptions = {
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        name: 'Razor Store',
        description: `Order #${orderId.slice(0, 8)}...`,
        amount: amountCents,
        currency: 'INR',
        handler: async (response: RazorpayResponse) => {
          setPaymentStatus('verifying');
          try {
            const verifyResponse = await fetch(getApiUrl('/payments/verify'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              const data = await verifyResponse.json();
              throw new Error(data.error || 'Payment verification failed');
            }

            setPaymentStatus('complete');
            onPaymentComplete('success');
          } catch (err) {
            console.error('[PaymentPage] Verification error:', err);
            setPaymentStatus('failed');
            setError(err instanceof Error ? err.message : 'Payment verification error');
            onPaymentComplete('failed');
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus('cancelled');
            setError('Payment cancelled by user. Your order is saved under Orders.');
            onPaymentComplete('cancelled');
          },
        },
        theme: {
          color: '#2563eb',
        },
      };

      const razorpay = new window.Razorpay(options);

      if (typeof (razorpay as any).on === 'function') {
        (razorpay as any).on('payment.failed', async (response: any) => {
          const errorObj = response?.error;
          const reason = errorObj?.description || errorObj?.reason || 'Payment failed';
          const razorpayPaymentId = errorObj?.metadata?.payment_id;

          if (errorObj?.reason === 'payment_cancelled') return;

          if (hasReportedFailureRef.current || (razorpayPaymentId && reportedPaymentIdsRef.current.has(razorpayPaymentId))) {
            return;
          }

          hasReportedFailureRef.current = true;
          if (razorpayPaymentId) {
            reportedPaymentIdsRef.current.add(razorpayPaymentId);
          }

          setPaymentStatus('failed');
          setError(reason);

          try {
            await fetch(getApiUrl('/payments/fail'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderId,
                reason,
                error_context: errorObj || { reason },
              }),
            });
          } catch (err) {
            console.warn('[PaymentPage] Failed to report payment failure to backend:', err);
          }

          onPaymentComplete('failed');
        });
      }

      razorpay.open();
    } catch (err) {
      console.error('[PaymentPage] Error opening Razorpay modal:', err);
      setPaymentStatus('failed');
      setError(err instanceof Error ? err.message : 'Failed to open payment gateway');
    }
  };

  const handleRetryPayment = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setPaymentStatus('loading');
    hasReportedFailureRef.current = false;

    try {
      const response = await fetch(getApiUrl('/payments/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment attempt');
      }

      const paymentData = await response.json();
      setRazorpayOrderId(paymentData.razorpay_order_id);
      setRazorpayKeyId(paymentData.razorpay_key_id);
      setPaymentStatus('ready');
    } catch (err) {
      console.error('[PaymentPage] Retry failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry payment');
      setPaymentStatus('failed');
    }
  };

  const handleDismissBackdrop = () => {
    if (paymentStatus !== 'processing' && paymentStatus !== 'verifying') {
      onCancel();
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (paymentStatus === 'complete') {
    return (
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl p-6 sm:p-8 text-center border space-y-4 themed relative my-auto max-h-[90vh] overflow-y-auto shadow-2xl"
          style={{
            background: 'var(--c-surface)',
            borderColor: 'var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-2"
            style={{
              background: 'var(--c-status-green-bg)',
              color: 'var(--c-status-green-text)',
            }}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-green-text)' }}>Payment Successful!</h2>
          <p className="text-xs" style={{ color: 'var(--c-text-dim)' }}>Your order has been confirmed.</p>
          <p className="text-xs font-mono truncate" style={{ color: 'var(--c-muted)' }}>Order ID: {orderId}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPaymentComplete('success');
            }}
            className="w-full py-3.5 px-6 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition font-display cursor-pointer"
            style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
          >
            Continue to Order
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div
        onClick={handleDismissBackdrop}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl p-6 sm:p-8 text-center border space-y-4 themed relative my-auto max-h-[90vh] overflow-y-auto shadow-2xl"
          style={{
            background: 'var(--c-surface)',
            borderColor: 'var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-2"
            style={{
              background: 'var(--c-status-red-bg)',
              color: 'var(--c-status-red-text)',
            }}
          >
            ✕
          </div>
          <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-red-text)' }}>Payment Failed</h2>
          <p className="text-xs break-words" style={{ color: 'var(--c-text-dim)' }}>{error || 'An error occurred during payment.'}</p>
          <p className="text-xs font-mono truncate" style={{ color: 'var(--c-muted)' }}>Order ID: {orderId.slice(0, 12)}...</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 py-3 px-4 font-bold text-xs sm:text-sm rounded-xl transition font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Back to Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 py-3 px-4 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition font-display cursor-pointer"
              style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
            >
              Retry Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'cancelled') {
    return (
      <div
        onClick={handleDismissBackdrop}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl p-6 sm:p-8 text-center border space-y-4 themed relative my-auto max-h-[90vh] overflow-y-auto shadow-2xl"
          style={{
            background: 'var(--c-surface)',
            borderColor: 'var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-2"
            style={{
              background: 'var(--c-status-amber-bg)',
              color: 'var(--c-status-amber-text)',
            }}
          >
            ⏸
          </div>
          <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>Payment Cancelled</h2>
          <p className="text-xs break-words" style={{ color: 'var(--c-text-dim)' }}>{error || 'Your order is saved and remains pending.'}</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 py-3 px-4 font-bold text-xs sm:text-sm rounded-xl transition font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              View Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 py-3 px-4 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition font-display cursor-pointer"
              style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
            >
              Continue Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleDismissBackdrop}
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 relative my-auto max-h-[90vh] overflow-y-auto border themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
          <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-tight" style={{ color: 'var(--c-text)' }}>Payment Gateway</h2>
          {paymentStatus !== 'processing' && paymentStatus !== 'verifying' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="p-1.5 rounded-xl transition-colors cursor-pointer"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-muted)',
              }}
              aria-label="Close payment gateway"
            >
              <IconClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Payment Summary */}
        <div className="p-4 rounded-xl border text-xs sm:text-sm space-y-2 themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <div className="flex justify-between">
            <p className="font-medium" style={{ color: 'var(--c-muted)' }}>Order Amount:</p>
            <p className="font-extrabold font-price" style={{ color: 'var(--c-text)' }}>{formatPrice(amountCents)}</p>
          </div>
          <div className="flex justify-between">
            <p className="font-medium" style={{ color: 'var(--c-muted)' }}>Order ID:</p>
            <p className="font-mono text-xs truncate max-w-[180px]" style={{ color: 'var(--c-text-dim)' }}>{orderId}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <PaymentStatus status={paymentStatus} />

        {/* Error Message */}
        {error && (
          <div className="p-3.5 rounded-xl text-xs font-semibold" style={{ background: 'var(--c-status-red-bg)', border: '1px solid var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Security Info */}
        <div className="border rounded-xl p-3.5 text-xs space-y-0.5 themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="font-bold flex items-center gap-1 font-display" style={{ color: 'var(--c-gold)' }}>🔒 Secure Checkout:</p>
          <p style={{ color: 'var(--c-muted)' }}>Your payment will be processed securely through Razorpay SSL encryption.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={paymentStatus === 'processing' || paymentStatus === 'verifying'}
            className="flex-1 py-3 px-4 font-bold rounded-xl text-xs sm:text-sm transition disabled:opacity-50 font-display cursor-pointer"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
          >
            Cancel
          </button>
          {paymentStatus === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRazorpay();
              }}
              disabled={!scriptLoaded}
              className="flex-1 py-3 px-4 font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 active:scale-98 font-display cursor-pointer"
              style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
            >
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

