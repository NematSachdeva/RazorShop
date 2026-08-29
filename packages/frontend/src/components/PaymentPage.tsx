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

/**
 * Load Razorpay Checkout script dynamically
 */
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

  // Synchronous refs to prevent duplicate calls / StrictMode double-execution
  const initStartedRef = useRef(false);
  const hasReportedFailureRef = useRef(false);
  const reportedPaymentIdsRef = useRef<Set<string>>(new Set());

  // Initialize payment details on mount
  useEffect(() => {
    if (initStartedRef.current) {
      return;
    }
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

  // Auto-open Razorpay once ready and script loaded
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

    // Debug log event
    console.log('[Razorpay] event=checkout_opening', {
      orderId,
      razorpayOrderId,
      amountCents,
    });

    try {
      const options: RazorpayOptions = {
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        name: 'Razor Store',
        description: `Order #${orderId.slice(0, 8)}...`,
        amount: amountCents,
        currency: 'INR',
        handler: async (response: RazorpayResponse) => {
          console.log('[Razorpay] event=payment_success', {
            orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
          });

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
            console.log('[Razorpay] event=modal_dismissed', { orderId });
            // Modal dismissal is user cancellation, NOT a payment failure!
            // Keeps order in pending state without invoking /payments/fail.
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

          // Guard 1: Ignore cancellations or modal dismissal events
          if (errorObj?.reason === 'payment_cancelled') {
            console.log('[Razorpay] Ignoring payment_cancelled event', { orderId });
            return;
          }

          // Guard 2: Prevent duplicate failure reporting for the same attempt / payment_id
          if (hasReportedFailureRef.current || (razorpayPaymentId && reportedPaymentIdsRef.current.has(razorpayPaymentId))) {
            console.log('[Razorpay] Duplicate payment.failed callback ignored', {
              orderId,
              razorpayPaymentId,
              reason,
            });
            return;
          }

          // Mark failure reported
          hasReportedFailureRef.current = true;
          if (razorpayPaymentId) {
            reportedPaymentIdsRef.current.add(razorpayPaymentId);
          }

          console.warn('[Razorpay] event=payment_failed', {
            orderId,
            razorpayOrderId,
            razorpayPaymentId,
            reason,
          });

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

  const handleRetryPayment = async () => {
    setError(null);
    setPaymentStatus('loading');
    hasReportedFailureRef.current = false; // Reset failure flag for fresh attempt

    try {
      // Create a fresh Razorpay order attempt for the same application order ID
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

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (paymentStatus === 'complete') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-4 text-green-600">✓</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">Your order has been confirmed.</p>
          <p className="text-sm text-gray-500 mb-6 font-mono">Order ID: {orderId}</p>
          <button
            onClick={() => onPaymentComplete('success')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
          >
            Continue to Order
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-4 text-red-600">✕</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h2>
          <p className="text-gray-600 mb-4">{error || 'An error occurred during payment.'}</p>
          <p className="text-sm text-gray-500 mb-6 font-mono">Order ID: {orderId.slice(0, 8)}...</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300"
            >
              Back to Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="text-4xl mb-4 text-amber-500">⏸</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h2>
          <p className="text-gray-600 mb-6">{error || 'Your order is saved and remains pending.'}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300"
            >
              View Orders
            </button>
            <button
              onClick={handleRetryPayment}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
            >
              Continue Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Payment</h2>

        {/* Payment Summary */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
          <div className="flex justify-between mb-2">
            <p className="text-gray-600">Order Amount:</p>
            <p className="font-semibold text-gray-900">{formatPrice(amountCents)}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-gray-600">Order ID:</p>
            <p className="font-mono text-sm text-gray-700">{orderId.slice(0, 8)}...</p>
          </div>
        </div>

        {/* Status Indicator */}
        <PaymentStatus status={paymentStatus} />

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Security Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6 text-sm text-blue-800">
          <p className="font-medium mb-1">Secure Payment:</p>
          <p>Your payment will be processed securely through Razorpay.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={paymentStatus === 'processing' || paymentStatus === 'verifying'}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          {paymentStatus === 'ready' && (
            <button
              onClick={handleOpenRazorpay}
              disabled={!scriptLoaded}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
