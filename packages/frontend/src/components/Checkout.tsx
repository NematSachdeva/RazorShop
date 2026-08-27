import { useState } from 'react';
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

  const handleCreateOrder = async () => {
    if (!cart.id) {
      setError('Cart is invalid');
      return;
    }

    setLoading(true);
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
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6">Order Summary</h2>

        {/* Order Details */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 max-h-64 overflow-y-auto">
          {cart.items.map((item) => (
            <div key={item.product_id} className="flex justify-between mb-3 pb-3 border-b">
              <div>
                <p className="font-medium text-gray-900">{item.product.name}</p>
                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold text-gray-900">{formatPrice(item.line_total_cents)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between text-lg">
            <p className="font-bold">Total:</p>
            <p className="font-bold text-blue-600">{formatPrice(cart.total_cents)}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateOrder}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Order...' : 'Proceed to Payment'}
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center mt-4">
          You will be redirected to complete payment after creating the order.
        </p>
      </div>
    </div>
  );
}
