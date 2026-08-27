import { useEffect, useState } from 'react';
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
 * Returns a promise that resolves when the script is loaded
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
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
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'ready' | 'processing' | 'verifying' | 'complete' | 'failed'>('loading');
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  // Create payment attempt and load Razorpay script
  // Use a ref to track if initialization has already started to prevent React.StrictMode double-invoke
  useEffect(() => {
    // Skip if already attempted
    if (initializationAttempted) {
      return;
    }

    const initPayment = async () => {
      try {
        // Load Razorpay Checkout script
        await loadRazorpayScript();
        setScriptLoaded(true);

        // Create payment attempt on backend
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
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        setPaymentStatus('failed');
      }
    };

    setInitializationAttempted(true);
    initPayment();
  }, [orderId, initializationAttempted]);

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
        description: `Order ${orderId.slice(0, 8)}...`,
        amount: amountCents,
        currency: 'INR',
        handler: async (response: RazorpayResponse) => {
          setPaymentStatus('verifying');
          try {
            // Verify payment on backend
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
            setPaymentStatus('failed');
            setError(err instanceof Error ? err.message : 'Payment verification error');
            onPaymentComplete('failed');
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus('ready');
            setError('Payment cancelled');
          },
        },
        theme: {
          color: '#2563eb',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setPaymentStatus('failed');
      setError(err instanceof Error ? err.message : 'Failed to open payment gateway');
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (paymentStatus === 'complete') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">Your order has been confirmed.</p>
          <p className="text-sm text-gray-500 mb-6">Order ID: {orderId}</p>
          <button
            onClick={() => onPaymentComplete('success')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
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
          <div className="text-5xl mb-4">✕</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-6">Order ID: {orderId}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setError(null);
                setPaymentStatus('loading');
                try {
                  // Create a new Razorpay order for retry
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
                  setError(err instanceof Error ? err.message : 'Failed to retry payment');
                  setPaymentStatus('failed');
                }
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6">Payment</h2>

        {/* Payment Summary */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between mb-2">
            <p className="text-gray-600">Order Amount:</p>
            <p className="font-semibold">{formatPrice(amountCents)}</p>
          </div>
          <div className="flex justify-between">
            <p className="text-gray-600">Order ID:</p>
            <p className="font-mono text-sm">{orderId.slice(0, 8)}...</p>
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

        {/* Information */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6 text-sm text-blue-800">
          <p className="font-medium mb-1">Secure Payment:</p>
          <p>Your payment will be processed securely through Razorpay.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={paymentStatus === 'processing' || paymentStatus === 'verifying'}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel Payment
          </button>
          {paymentStatus === 'ready' && (
            <button
              onClick={handleOpenRazorpay}
              disabled={!scriptLoaded}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
