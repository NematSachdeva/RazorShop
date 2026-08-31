import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getApiUrl } from '../config/api';
import { authService } from '../services/authService';
import { OrderDTO, PaymentDTO } from '@razor/shared';

import OrderFeedbackModal from './OrderFeedbackModal';
import { OrderTimelineView, TimelineEvent } from './OrderTimelineView';
import { IconPackage, IconRefresh, IconPhone, IconCheck } from './common/Icons';

function CustomerOrderTimeline({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch(getApiUrl(`/orders/${orderId}/timeline`), {
      headers: { ...authService.getAuthHeader() },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (isMounted) setTimeline(data || []);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [orderId, currentStatus]);

  return <OrderTimelineView timeline={timeline} currentStatus={currentStatus} />;
}

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

  // Feedback Modal
  const [feedbackModalState, setFeedbackModalState] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
  });

  // Cancellation Modal State
  const [cancelModalState, setCancelModalState] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
    totalCents: number;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
    totalCents: 0,
  });
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Return Modal State
  const [returnModalState, setReturnModalState] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
    totalCents: number;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
    totalCents: 0,
  });
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const handleOpenFeedback = (orderId: string, orderNumber: string) => {
    setFeedbackModalState({
      isOpen: true,
      orderId,
      orderNumber,
    });
  };

  const handleOpenCancelModal = (orderId: string, orderNumber: string, totalCents: number) => {
    setCancellationReason('');
    setCancelError(null);
    setCancelModalState({
      isOpen: true,
      orderId,
      orderNumber,
      totalCents,
    });
  };

  const handleOpenReturnModal = (orderId: string, orderNumber: string, totalCents: number) => {
    setReturnReason('');
    setReturnError(null);
    setReturnModalState({
      isOpen: true,
      orderId,
      orderNumber,
      totalCents,
    });
  };

  const handleConfirmCancellation = async () => {
    if (!cancellationReason.trim()) {
      setCancelError('Please enter a reason for cancellation');
      return;
    }

    setSubmittingCancel(true);
    setCancelError(null);

    try {
      const user = authService.getUser();
      const response = await fetch(getApiUrl(`/orders/${cancelModalState.orderId}/cancel`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          reason: cancellationReason.trim(),
          customer_id: user?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel order');
      }

      setCancelModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 });
      await fetchOrders();
    } catch (err: any) {
      setCancelError(err.message || 'Error executing order cancellation');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!returnReason.trim()) {
      setReturnError('Please enter a reason for returning this order');
      return;
    }

    setSubmittingReturn(true);
    setReturnError(null);

    try {
      const user = authService.getUser();
      const response = await fetch(getApiUrl(`/orders/${returnModalState.orderId}/return`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          reason: returnReason.trim(),
          customer_id: user?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit return request');
      }

      setReturnModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 });
      await fetchOrders();
    } catch (err: any) {
      setReturnError(err.message || 'Error submitting return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

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
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center py-16">
        <p className="text-gray-600 font-medium">Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center py-16 text-red-600">
        <p className="font-bold">{error}</p>
        <button
          onClick={fetchOrders}
          className="mt-4 px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (ordersWithPayments.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center py-16 text-gray-600 space-y-3 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
          <IconPackage className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">No Orders Found</h3>
        <p className="text-xs text-gray-500 max-w-xs mx-auto">You haven't placed any orders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center pb-2">
        <div className="flex items-center gap-2.5">
          <IconPackage className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-black text-gray-900">Your Orders & Tracking</h2>
        </div>
        <button
          onClick={fetchOrders}
          className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
        >
          <IconRefresh className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {ordersWithPayments.map(({ order, payment, loadingPayment }) => {
        const isCancelled = order.status === 'cancelled';
        const isConfirmed = (order.status === 'confirmed' || payment?.status === 'captured') && !isCancelled;
        const isFailed = payment?.status === 'failed' && !isCancelled;
        const isPending = !isConfirmed && !isFailed && !isCancelled && order.status === 'pending';
        const isTarget = Boolean(targetOrderId && order.id === targetOrderId);

        const isDispatchedOrDelivered =
          order.status === 'dispatched' ||
          order.status === 'shipped' ||
          order.status === 'delivered' ||
          (order.return_status && order.return_status !== 'none');

        const canCancel = order.status === 'confirmed' && !isDispatchedOrDelivered && !isCancelled;
        const canReturn = order.status === 'delivered' && (!order.return_status || order.return_status === 'none');

        return (
          <div
            key={order.id}
            className={`bg-white rounded-2xl shadow-sm p-6 border transition-all ${
              isTarget ? 'border-2 border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-gray-200'
            }`}
          >
            <div className="flex flex-wrap justify-between items-start border-b border-gray-100 pb-4 mb-4 gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-gray-500 block mb-1">
                  Order #{order.order_number}
                </span>
                <p className="text-xs text-gray-400">Placed on: {formatDate(order.created_at)}</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Order Status Badge */}
                {isCancelled && (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    Order Cancelled
                  </span>
                )}
                {isConfirmed && order.status === 'confirmed' && (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Paid / Confirmed
                  </span>
                )}
                {order.status === 'dispatched' || order.status === 'shipped' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Dispatched
                  </span>
                ) : null}
                {order.status === 'delivered' && (!order.return_status || order.return_status === 'none') ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Delivered
                  </span>
                ) : null}
                {order.return_status === 'return_requested' || order.status === 'return_requested' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Return Requested
                  </span>
                ) : null}
                {order.return_status === 'return_approved' || order.status === 'return_approved' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Return Approved
                  </span>
                ) : null}
                {order.return_status === 'return_rejected' || order.status === 'return_rejected' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    Return Rejected
                  </span>
                ) : null}
                {order.return_status === 'pickup_scheduled' || order.status === 'pickup_scheduled' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                    Pickup Scheduled
                  </span>
                ) : null}
                {order.return_status === 'order_picked_up' || order.status === 'order_picked_up' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Order Picked Up
                  </span>
                ) : null}
                {order.return_status === 'return_in_transit' || order.status === 'return_in_transit' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                    Return In Transit
                  </span>
                ) : null}
                {order.return_status === 'refund_initiated' || order.status === 'refund_initiated' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Refund Initiated
                  </span>
                ) : null}
                {order.return_status === 'order_returned_to_seller' || order.status === 'order_returned_to_seller' ? (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Returned to Seller
                  </span>
                ) : null}
                {isFailed && (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    Payment Failed
                  </span>
                )}
                {isPending && (
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Pending Payment
                  </span>
                )}

                {/* Total */}
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase">Total</p>
                  <p className="text-lg font-black text-blue-700">{formatPrice(order.total_cents)}</p>
                </div>
              </div>
            </div>

            {/* Cancellation Message Banner */}
            {isCancelled && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
                <p className="font-extrabold text-sm text-rose-800 flex items-center gap-1.5">
                  <span>Order Cancelled</span>
                </p>
                <p className="font-medium">
                  Your order for <strong>{formatPrice(order.total_cents)}</strong> has been cancelled. The amount will be refunded to your original payment method within 5–7 days.
                </p>
                {order.cancellation_reason && (
                  <p className="text-rose-700 text-[11px] pt-1 border-t border-rose-100">
                    <span className="font-bold">Reason:</span> {order.cancellation_reason}
                  </p>
                )}
              </div>
            )}

            {/* Refund Initiated Banner */}
            {(order.return_status === 'refund_initiated' || order.status === 'refund_initiated') && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5 text-emerald-900">
                <p className="font-extrabold text-sm text-emerald-800 flex items-center gap-1.5">
                  <IconCheck className="w-4 h-4 text-emerald-600" />
                  <span>Refund Initiated</span>
                </p>
                <p className="font-medium">
                  Your refund of <strong>{formatPrice(order.total_cents)}</strong> has been initiated to your source payment method. The amount should reflect in your account within 5–7 days.
                </p>
                {order.refund_initiated_at && (
                  <p className="text-emerald-700 text-[11px] font-mono">
                    Initiated on: {new Date(order.refund_initiated_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Return Banner */}
            {order.return_status && order.return_status !== 'none' && order.return_status !== 'refund_initiated' && (
              <div className="mb-4 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
                <p className="font-bold text-amber-800 text-sm">
                  Return Status: {order.return_status.replace(/_/g, ' ').toUpperCase()}
                </p>
                {order.return_reason && (
                  <p className="text-amber-700">
                    <span className="font-semibold">Reason:</span> {order.return_reason}
                  </p>
                )}
                {order.return_rejection_reason && (
                  <p className="text-rose-700 font-medium">
                    <span className="font-semibold">Rejection Reason:</span> {order.return_rejection_reason}
                  </p>
                )}
                {order.pickup_notes && (
                  <p className="text-amber-800">
                    <span className="font-semibold">Pickup Notes:</span> {order.pickup_notes}
                  </p>
                )}
              </div>
            )}

            {/* Order Items */}
            <div className="space-y-2 mb-6">
              {order.items.map((item) => (
                <div key={item.id || item.product_id} className="flex justify-between text-xs py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">
                      {item.product?.name || `Product (${item.product_id.slice(0, 8)})`}
                    </span>
                    <span className="text-gray-500 font-semibold">x{item.quantity}</span>
                  </div>
                  <span className="font-bold text-gray-800">
                    {formatPrice(item.line_total_cents)}
                  </span>
                </div>
              ))}
            </div>

            {/* Delivery Address Snapshot */}
            {order.shipping_address && (
              <div className="mb-4 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-gray-700 block text-[11px] uppercase tracking-wider">
                  Delivery Address Snapshot
                </span>
                <p className="text-gray-900 font-bold">{order.shipping_address.full_address}</p>
                <p className="text-gray-600">
                  {order.shipping_address.state} — {order.shipping_address.pin_code}
                </p>
                {order.shipping_address.phone && (
                  <p className="text-gray-500 flex items-center gap-1.5 pt-0.5">
                    <IconPhone className="w-3.5 h-3.5" />
                    <span>{order.shipping_address.phone}</span>
                  </p>
                )}
              </div>
            )}

            {/* Failure reason if failed */}
            {isFailed && payment?.failure_reason && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                <span className="font-bold">Reason for failure: </span>
                {payment.failure_reason}
              </div>
            )}

            {/* Order Timeline Component */}
            {!isPending && !isFailed && (
              <div className="mb-4">
                <CustomerOrderTimeline orderId={order.id} currentStatus={order.status} />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-between items-center pt-4 border-t border-gray-100 gap-3">
              <div>
                <button
                  onClick={() => handleOpenFeedback(order.id, order.order_number)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <span>Feedback</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Cancel Order Button */}
                {canCancel && (
                  <button
                    onClick={() => handleOpenCancelModal(order.id, order.order_number, order.total_cents)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Cancel Order
                  </button>
                )}

                {/* Request Return Button */}
                {canReturn && (
                  <button
                    onClick={() => handleOpenReturnModal(order.id, order.order_number, order.total_cents)}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Request Return
                  </button>
                )}

                {isConfirmed && !canCancel && !canReturn && (
                  <button
                    disabled
                    className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold cursor-default flex items-center gap-1.5"
                  >
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Paid / Completed</span>
                  </button>
                )}

                {isPending && (
                  <button
                    onClick={() => onContinuePayment(order.id, order.total_cents)}
                    disabled={loadingPayment}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                  >
                    Continue Payment
                  </button>
                )}

                {isFailed && (
                  <button
                    onClick={() => onRetryPayment(order.id, order.total_cents)}
                    disabled={loadingPayment}
                    className="px-5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50 transition shadow-sm"
                  >
                    Retry Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Cancellation Modal */}
      {cancelModalState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Cancel Order #{cancelModalState.orderNumber}</h3>
                <p className="text-xs text-gray-500 font-medium">Please provide a reason for cancelling this order.</p>
              </div>

              {cancelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl">
                  {cancelError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Why do you want to cancel this order? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please enter your cancellation reason..."
                  rows={3}
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-sans"
                />
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <p className="font-bold">Refund Notice:</p>
                <p className="leading-relaxed">
                  Your order was placed for <strong>{formatPrice(cancelModalState.totalCents)}</strong>. The same amount will be refunded to your source payment method within 5–7 days.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 })}
                  disabled={submittingCancel}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancellation}
                  disabled={submittingCancel}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Return Request Modal */}
      {returnModalState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Request Return for #{returnModalState.orderNumber}</h3>
                <p className="text-xs text-gray-500 font-medium">Provide a reason for returning your delivered order.</p>
              </div>

              {returnError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl">
                  {returnError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Why do you want to return this order? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Enter return reason (e.g. damaged, wrong size, defective)..."
                  rows={3}
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-sans"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <p className="font-medium">
                  Order Total: <strong>{formatPrice(returnModalState.totalCents)}</strong>
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 })}
                  disabled={submittingReturn}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={submittingReturn}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {submittingReturn ? 'Submitting...' : 'Request Return'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Feedback Modal */}
      {feedbackModalState.orderId && (
        <OrderFeedbackModal
          orderId={feedbackModalState.orderId}
          orderNumber={feedbackModalState.orderNumber}
          isOpen={feedbackModalState.isOpen}
          onClose={() => setFeedbackModalState({ isOpen: false, orderId: '', orderNumber: '' })}
          onFeedbackSaved={fetchOrders}
        />
      )}
    </div>
  );
}
