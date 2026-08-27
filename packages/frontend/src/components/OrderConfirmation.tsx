import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';

interface OrderConfirmationProps {
  orderId: string;
  onDone: () => void;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  items: Array<{
    product_id: string;
    quantity: number;
    price_cents: number;
    line_total_cents: number;
  }>;
  created_at: string;
}

export default function OrderConfirmation({ orderId, onDone }: OrderConfirmationProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(getApiUrl(`/orders/${orderId}`));
        if (!response.ok) {
          throw new Error('Failed to load order');
        }
        const data: Order = await response.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="animate-spin inline-block mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Order</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onDone}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✓</div>
          <h2 className="text-3xl font-bold text-green-600 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600">Thank you for your purchase</p>
        </div>

        {/* Order Details */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">Order Number</p>
              <p className="text-lg font-mono font-semibold">{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Status</p>
              <p className="text-lg font-semibold capitalize">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded">
                  {order.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Date</p>
              <p className="text-base">{formatDate(order.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order ID</p>
              <p className="text-sm font-mono text-gray-600">{orderId.slice(0, 16)}...</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Order Items</h3>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">Product ID: {item.product_id.slice(0, 8)}...</p>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(item.line_total_cents)}</p>
                  <p className="text-xs text-gray-600">@ {formatPrice(item.price_cents)} each</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between mb-2 text-gray-600">
            <p>Subtotal:</p>
            <p>{formatPrice(order.total_cents)}</p>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <p>Order Total:</p>
            <p className="text-blue-600">{formatPrice(order.total_cents)}</p>
          </div>
        </div>

        {/* Information Box */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Next Steps:</strong> Your order has been confirmed and is now being prepared. You will receive an email confirmation shortly.
          </p>
        </div>

        {/* Action */}
        <button
          onClick={onDone}
          className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
