import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import PaymentStatus from './PaymentStatus';

interface PaymentPageProps {
  orderId: string;
  amountCents: number;
  onPaymentComplete: (status: 'success' | 'failed' | 'cancelled') => void;
  onCancel: () => void;
}

export default function PaymentPage({
  orderId,
  amountCents,
  onPaymentComplete,
  onCancel,
}: PaymentPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'ready' | 'processing' | 'verifying' | 'complete' | 'failed'>('loading');

  // Create payment attempt
  useEffect(() => {
    const createPayment = async () => {
      try {
        const response = await fetch(getApiUrl('/payments/create'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create payment');
        }

        // Payment created successfully - response contains razorpay order details
        await response.json();
        setPaymentStatus('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create payment');
        setPaymentStatus('failed');
      }
    };

    createPayment();
  }, [orderId]);

  const handleTestPayment = async (success: boolean) => {
    // Simulated payment flow for testing
    // In production, this would integrate with actual Razorpay checkout
    setPaymentStatus('processing');

    if (success) {
      // Simulate payment success
      setTimeout(async () => {
        setPaymentStatus('verifying');
        
        // Mock payment verification
        const mockPaymentId = 'pay_test_' + Date.now();
        const mockSignature = 'mock_signature_' + Date.now();

        try {
          const response = await fetch(getApiUrl('/payments/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderId,
              razorpay_payment_id: mockPaymentId,
              razorpay_signature: mockSignature,
            }),
          });

          if (response.ok) {
            setPaymentStatus('complete');
            onPaymentComplete('success');
          } else {
            setPaymentStatus('failed');
            setError('Payment verification failed');
            onPaymentComplete('failed');
          }
        } catch (err) {
          setPaymentStatus('failed');
          setError('Payment verification error');
          onPaymentComplete('failed');
        }
      }, 2000);
    } else {
      // Simulate payment failure
      setPaymentStatus('failed');
      setError('Payment was declined');
      setTimeout(() => {
        onPaymentComplete('failed');
      }, 1500);
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
              onClick={() => {
                setPaymentStatus('ready');
                setError(null);
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

        {/* Test Payment Controls (for development/testing) */}
        {paymentStatus === 'ready' && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <p className="text-sm text-blue-800 mb-4">
              <strong>Test Mode:</strong> For demonstration purposes, you can simulate payment:
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleTestPayment(true)}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Simulate Success
              </button>
              <button
                onClick={() => handleTestPayment(false)}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Simulate Failure
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Information */}
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-sm text-yellow-800">
          <p className="font-medium mb-1">Note:</p>
          <p>This is a test implementation. In production, this would redirect to the actual Razorpay checkout.</p>
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
              disabled
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
            >
              Razorpay (M4)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
