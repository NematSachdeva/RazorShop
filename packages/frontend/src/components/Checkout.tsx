import { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import { getApiUrl } from '../config/api';

interface CheckoutProps {
  cart: CartDTO;
  customerId: string;
  onOrderCreated: (orderId: string, amount: number) => void;
  onCancel: () => void;
}

interface Order {
  id: string;
  order_number: string;
  total_cents: number;
}

export default function Checkout({ cart, customerId, onOrderCreated, onCancel }: CheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderCreationAttempted, setOrderCreationAttempted] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleCreateOrder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent double-submission
    if (loading || orderCreationAttempted) {
      return;
    }

    if (!cart.id) {
      setError('Cart is invalid');
      return;
    }

    setLoading(true);
    setOrderCreationAttempted(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_id: cart.id,
          customer_id: customerId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create order');
      }

      const order: Order = await response.json();
      onOrderCreated(order.id, order.total_cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOrderCreationAttempted(false);
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto border border-gray-100"
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">Order Summary</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 rounded-full hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Order Details */}
        <div className="bg-gray-50 p-4 rounded-xl mb-5 max-h-60 overflow-y-auto border border-gray-100 space-y-3">
          {cart.items.map((item) => (
            <div key={item.product_id} className="flex justify-between items-start pb-3 border-b border-gray-200/60 last:border-0 last:pb-0 gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 text-xs sm:text-sm break-words">{item.product.name}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Qty: {item.quantity}</p>
              </div>
              <p className="font-extrabold text-gray-900 text-xs sm:text-sm shrink-0">{formatPrice(item.line_total_cents)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 pt-4 mb-6 space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between text-gray-600">
            <p>Subtotal:</p>
            <p className="font-semibold">{formatPrice(cart.subtotal_cents || cart.total_cents)}</p>
          </div>

          {((cart.discount_cents && cart.discount_cents > 0) || (cart.discount_percent && cart.discount_percent > 0)) && (
            <div className="flex justify-between text-xs text-green-700 bg-green-50 p-2.5 rounded-xl border border-green-200 font-medium">
              <p>🎁 Combo Discount ({cart.discount_percent}% OFF):</p>
              <p className="font-bold">-{formatPrice(cart.discount_cents || 0)}</p>
            </div>
          )}

          <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-100">
            <p>Total Amount:</p>
            <p className="text-blue-700">{formatPrice(cart.total_cents)}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-xs sm:text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateOrder}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 text-xs sm:text-sm shadow-md transition disabled:opacity-50 active:scale-98"
          >
            {loading ? 'Creating Order...' : 'Proceed to Payment'}
          </button>
        </div>

        <p className="text-[11px] text-gray-500 text-center mt-4">
          🔒 Secure payment via Razorpay.
        </p>
      </div>
    </div>
  );
}
