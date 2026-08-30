import { useEffect, useState, useRef } from 'react';
import { getApiUrl } from '../config/api';
import PaymentStatus from './PaymentStatus';

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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center border border-gray-100"
        >
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-2xl font-black text-green-700 mb-2">Payment Successful!</h2>
          <p className="text-xs text-gray-600 mb-4">Your order has been confirmed.</p>
          <p className="text-xs text-gray-400 font-mono mb-6 truncate">Order ID: {orderId}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPaymentComplete('success');
            }}
            className="w-full py-3.5 px-6 bg-green-600 text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-green-700 shadow-md transition"
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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center border border-gray-100"
        >
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
            ✕
          </div>
          <h2 className="text-2xl font-black text-rose-600 mb-2">Payment Failed</h2>
          <p className="text-xs text-gray-600 mb-4 break-words">{error || 'An error occurred during payment.'}</p>
          <p className="text-xs text-gray-400 font-mono mb-6 truncate">Order ID: {orderId.slice(0, 12)}...</p>
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold text-xs sm:text-sm rounded-xl hover:bg-gray-200 transition"
            >
              Back to Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-blue-700 shadow-md transition"
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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center border border-gray-100"
        >
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
            ⏸
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Cancelled</h2>
          <p className="text-xs text-gray-600 mb-6 break-words">{error || 'Your order is saved and remains pending.'}</p>
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold text-xs sm:text-sm rounded-xl hover:bg-gray-200 transition"
            >
              View Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-blue-700 shadow-md transition"
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
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative border border-gray-100"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900">Payment Gateway</h2>
          {paymentStatus !== 'processing' && paymentStatus !== 'verifying' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 rounded-full hover:bg-gray-100 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Payment Summary */}
        <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100 text-xs sm:text-sm space-y-2">
          <div className="flex justify-between">
            <p className="text-gray-500 font-medium">Order Amount:</p>
            <p className="font-extrabold text-gray-900">{formatPrice(amountCents)}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-gray-500 font-medium">Order ID:</p>
            <p className="font-mono text-xs text-gray-700 truncate max-w-[180px]">{orderId}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <PaymentStatus status={paymentStatus} />

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Security Info */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 mb-6 text-xs text-blue-900">
          <p className="font-bold mb-0.5">🔒 Secure Checkout:</p>
          <p className="text-blue-800">Your payment will be processed securely through Razorpay SSL encryption.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={paymentStatus === 'processing' || paymentStatus === 'verifying'}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold text-xs sm:text-sm rounded-xl hover:bg-gray-200 transition disabled:opacity-50"
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
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-blue-700 shadow-md transition disabled:opacity-50 active:scale-98"
            >
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
