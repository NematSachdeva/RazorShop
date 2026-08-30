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
    product?: {
      name: string;
    };
  }>;
  created_at: string;
}

export default function OrderConfirmation({ orderId, onDone }: OrderConfirmationProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDone();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDone]);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(getApiUrl(`/orders/${orderId}`));
        if (!response.ok) {
          throw new Error('Failed to load order details');
        }
        const data: Order = await response.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred loading order');
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center font-sans">
          <div className="animate-spin inline-block mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600 font-semibold text-sm">Loading confirmed order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center font-sans">
          <h2 className="text-xl font-extrabold text-rose-600 mb-3">Error Loading Order</h2>
          <p className="text-xs text-gray-600 mb-6">{error}</p>
          <button
            onClick={onDone}
            className="w-full py-3 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-8 relative my-auto border border-gray-100 space-y-6"
      >
        {/* Close Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-base transition-colors"
          aria-label="Close order confirmation modal"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center pt-2">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-inner">
            ✓
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">Order Confirmed!</h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            Thank you for your purchase. Your order is being processed.
          </p>
        </div>

        {/* Order Meta Grid */}
        <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200/80">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Order Number</p>
              <p className="text-sm font-mono font-extrabold text-gray-900 mt-0.5">{order.order_number}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Status</p>
              <p className="mt-0.5">
                <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-emerald-200">
                  {order.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Order Date</p>
              <p className="text-xs font-bold text-gray-800 mt-0.5">{formatDate(order.created_at)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Order ID</p>
              <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{orderId.slice(0, 12)}...</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-3">Order Items</h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50/80 rounded-xl border border-gray-100 text-xs">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="font-bold text-gray-900 truncate">
                    {item.product?.name || `Product ID: ${item.product_id.slice(0, 8)}...`}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-gray-900">{formatPrice(item.line_total_cents)}</p>
                  <p className="text-[10px] text-gray-400">@ {formatPrice(item.price_cents)} each</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 pt-4 space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between text-gray-600">
            <p>Subtotal:</p>
            <p className="font-semibold">{formatPrice(order.total_cents)}</p>
          </div>
          <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
            <p>Order Total:</p>
            <p className="text-blue-700">{formatPrice(order.total_cents)}</p>
          </div>
        </div>

        {/* Next Steps Info Box */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
          <p className="font-bold mb-1">🎉 What Happens Next?</p>
          <p className="text-blue-800">
            Your payment is verified and confirmed. You can track your order status anytime from your <strong>Orders</strong> page.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
          className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
