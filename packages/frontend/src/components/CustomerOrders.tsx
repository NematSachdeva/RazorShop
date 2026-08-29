import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import { authService } from '../services/authService';
import { OrderDTO, PaymentDTO } from '@razor/shared';

interface CustomerOrdersProps {
  onContinuePayment: (orderId: string, amountCents: number) => void;
  onRetryPayment: (orderId: string, amountCents: number) => void;
  targetOrderId?: string | null;
}

interface OrderWithPayment {
  order: OrderDTO;
  payment: PaymentDTO | null;
  loadingPayment: boolean;
}

export default function CustomerOrders({ onContinuePayment, onRetryPayment, targetOrderId }: CustomerOrdersProps) {
  const [ordersWithPayments, setOrdersWithPayments] = useState<OrderWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = authService.getUser();
      if (!user) {
        setError('Please log in to view orders');
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl(`/orders?customer_id=${user.id}`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load orders');
      }

      const data = await response.json();
      const ordersList: OrderDTO[] = data.data || [];

      // Fetch payment details for each order in parallel
      const initialOrdersWithPayments: OrderWithPayment[] = ordersList.map((order) => ({
        order,
        payment: null,
        loadingPayment: true,
      }));
      setOrdersWithPayments(initialOrdersWithPayments);

      // Async fetch payment status for each order
      ordersList.forEach(async (order, index) => {
        try {
          const paymentResponse = await fetch(getApiUrl(`/payments/${order.id}`), {
            headers: {
              ...authService.getAuthHeader(),
            },
          });
          let paymentData: PaymentDTO | null = null;
          if (paymentResponse.ok) {
            paymentData = await paymentResponse.json();
          }
          setOrdersWithPayments((prev) => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                payment: paymentData,
                loadingPayment: false,
              };
            }
            return next;
          });
        } catch {
          setOrdersWithPayments((prev) => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                loadingPayment: false,
              };
            }
            return next;
          });
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: Date | string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center py-12">
        <p className="text-gray-600">Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center py-12 text-red-600">
        <p>{error}</p>
        <button
          onClick={fetchOrders}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (ordersWithPayments.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center py-12 text-gray-600">
        <h3 className="text-xl font-bold mb-2">No Orders Found</h3>
        <p>You haven't placed any orders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Your Orders</h2>
        <button
          onClick={fetchOrders}
          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
        >
          Refresh Orders
        </button>
      </div>

      {ordersWithPayments.map(({ order, payment, loadingPayment }) => {
        const isConfirmed = order.status === 'confirmed' || payment?.status === 'captured';
        const isFailed = payment?.status === 'failed';
        const isPending = !isConfirmed && !isFailed;
        const isTarget = Boolean(targetOrderId && order.id === targetOrderId);

        return (
          <div key={order.id} className={`bg-white rounded-lg shadow p-6 border transition ${isTarget ? 'border-2 border-amber-500 ring-2 ring-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
            <div className="flex flex-wrap justify-between items-start border-b pb-4 mb-4 gap-4">
              <div>
                <span className="font-mono text-sm text-gray-500 block mb-1">
                  Order #{order.order_number}
                </span>
                <p className="text-xs text-gray-400">Placed on: {formatDate(order.created_at)}</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Order Status Badge */}
                {isConfirmed && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Paid / Completed
                  </span>
                )}
                {isFailed && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                    Payment Failed
                  </span>
                )}
                {isPending && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                    Pending Payment
                  </span>
                )}

                {/* Total */}
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-lg font-bold text-blue-600">{formatPrice(order.total_cents)}</p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2 mb-6">
              {order.items.map((item) => (
                <div key={item.id || item.product_id} className="flex justify-between text-sm py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {item.product?.name || `Product (${item.product_id.slice(0, 8)})`}
                    </span>
                    <span className="text-gray-500">x{item.quantity}</span>
                  </div>
                  <span className="font-medium text-gray-700">
                    {formatPrice(item.line_total_cents)}
                  </span>
                </div>
              ))}
            </div>

            {/* Failure reason if failed */}
            {isFailed && payment?.failure_reason && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <span className="font-semibold">Reason for failure: </span>
                {payment.failure_reason}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              {isConfirmed && (
                <button
                  disabled
                  className="px-4 py-2 bg-green-50 text-green-700 rounded text-sm font-semibold cursor-default"
                >
                  ✓ Paid / Completed
                </button>
              )}

              {isPending && (
                <button
                  onClick={() => onContinuePayment(order.id, order.total_cents)}
                  disabled={loadingPayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue Payment
                </button>
              )}

              {isFailed && (
                <button
                  onClick={() => onRetryPayment(order.id, order.total_cents)}
                  disabled={loadingPayment}
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  Retry Payment
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
