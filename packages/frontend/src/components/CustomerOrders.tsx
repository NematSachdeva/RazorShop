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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(targetOrderId || null);

  // Sync targetOrderId if passed from parent
  useEffect(() => {
    if (targetOrderId) {
      setSelectedOrderId(targetOrderId);
    }
  }, [targetOrderId]);

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

      const initialOrdersWithPayments: OrderWithPayment[] = ordersList.map((order) => ({
        order,
        payment: null,
        loadingPayment: true,
      }));
      setOrdersWithPayments(initialOrdersWithPayments);

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

  // Helper for Status Badge Rendering
  const renderStatusBadge = (order: OrderDTO, payment: PaymentDTO | null) => {
    const isCancelled = order.status === 'cancelled';
    const isConfirmed = (order.status === 'confirmed' || payment?.status === 'captured') && !isCancelled;
    const isFailed = payment?.status === 'failed' && !isCancelled;
    const isPending = !isConfirmed && !isFailed && !isCancelled && order.status === 'pending';

    if (isCancelled) {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}>
          Order Cancelled
        </span>
      );
    }
    if (order.return_status === 'return_requested' || order.status === 'return_requested') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border-soft)' }}>
          Return Requested
        </span>
      );
    }
    if (order.return_status === 'return_approved' || order.status === 'return_approved') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
          Return Approved
        </span>
      );
    }
    if (order.return_status === 'refund_initiated' || order.status === 'refund_initiated') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
          Refund Initiated
        </span>
      );
    }
    if (order.status === 'delivered') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-border-soft)' }}>
          Delivered
        </span>
      );
    }
    if (order.status === 'dispatched' || order.status === 'shipped') {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
          Dispatched
        </span>
      );
    }
    if (isConfirmed) {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
          Paid / Confirmed
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}>
          Payment Failed
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border-soft)' }}>
          Pending Payment
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full font-display" style={{ background: 'var(--c-surface2)', color: 'var(--c-text-dim)', border: '1px solid var(--c-border-soft)' }}>
        {order.status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-12 text-center border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
        <p className="text-sm font-medium font-display">Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-12 text-center border themed space-y-4" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-status-red-bg)', color: 'var(--c-text)' }}>
        <p className="font-bold font-display" style={{ color: 'var(--c-status-red-text)' }}>{error}</p>
        <button
          onClick={fetchOrders}
          className="px-5 py-2.5 font-bold text-xs rounded-xl font-display cursor-pointer"
          style={{ background: 'var(--c-gold)', color: '#0a0908' }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (ordersWithPayments.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center border space-y-3 font-sans themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--c-surface2)', color: 'var(--c-gold)' }}>
          <IconPackage className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>No Orders Found</h3>
        <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--c-muted)' }}>You haven't placed any orders yet.</p>
      </div>
    );
  }

  // Selected Order Detail View
  const selectedOrderObj = ordersWithPayments.find((item) => item.order.id === selectedOrderId);

  if (selectedOrderObj) {
    const { order, payment, loadingPayment } = selectedOrderObj;
    const isCancelled = order.status === 'cancelled';
    const isConfirmed = (order.status === 'confirmed' || payment?.status === 'captured') && !isCancelled;
    const isFailed = payment?.status === 'failed' && !isCancelled;
    const isPending = !isConfirmed && !isFailed && !isCancelled && order.status === 'pending';

    const isDispatchedOrDelivered =
      order.status === 'dispatched' ||
      order.status === 'shipped' ||
      order.status === 'delivered' ||
      (order.return_status && order.return_status !== 'none');

    const canCancel = order.status === 'confirmed' && !isDispatchedOrDelivered && !isCancelled;
    const canReturn = order.status === 'delivered' && (!order.return_status || order.return_status === 'none');

    return (
      <div className="space-y-6 font-sans">
        {/* Back Button and Title */}
        <div className="flex items-center justify-between pb-2">
          <button
            onClick={() => setSelectedOrderId(null)}
            className="px-4 py-2 rounded-xl text-xs font-bold font-display transition cursor-pointer flex items-center gap-2"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          >
            <span>← Back to Orders</span>
          </button>
          <button
            onClick={fetchOrders}
            className="px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 font-display cursor-pointer"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
          >
            <IconRefresh className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Detailed Order Card */}
        <div
          className="rounded-2xl p-6 border themed space-y-6"
          style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
        >
          {/* Header section */}
          <div className="flex flex-wrap justify-between items-start pb-4 border-b gap-4" style={{ borderColor: 'var(--c-border-soft)' }}>
            <div>
              <span className="font-mono text-xs font-bold block mb-1" style={{ color: 'var(--c-gold)' }}>
                ORDER #{order.order_number}
              </span>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Placed on: {formatDate(order.created_at)}</p>
            </div>

            <div className="flex items-center gap-4">
              {renderStatusBadge(order, payment)}
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase font-display" style={{ color: 'var(--c-muted)' }}>Total</p>
                <p className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>{formatPrice(order.total_cents)}</p>
              </div>
            </div>
          </div>

          {/* Cancellation Banner */}
          {isCancelled && (
            <div className="p-4 rounded-xl text-xs space-y-1.5 border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
              <p className="font-bold text-sm flex items-center gap-1.5 font-display">
                <span>Order Cancelled</span>
              </p>
              <p className="font-medium">
                Your order for <strong>{formatPrice(order.total_cents)}</strong> has been cancelled. The amount will be refunded to your original payment method within 5–7 days.
              </p>
              {order.cancellation_reason && (
                <p className="text-[11px] pt-1 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <span className="font-bold">Reason:</span> {order.cancellation_reason}
                </p>
              )}
            </div>
          )}

          {/* Refund Initiated Banner */}
          {(order.return_status === 'refund_initiated' || order.status === 'refund_initiated') && (
            <div className="p-4 rounded-xl text-xs space-y-1.5 border" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', borderColor: 'var(--c-border)' }}>
              <p className="font-bold text-sm flex items-center gap-1.5 font-display">
                <IconCheck className="w-4 h-4" />
                <span>Refund Initiated</span>
              </p>
              <p className="font-medium">
                Your refund of <strong>{formatPrice(order.total_cents)}</strong> has been initiated to your source payment method.
              </p>
            </div>
          )}

          {/* Return Banner */}
          {order.return_status && order.return_status !== 'none' && order.return_status !== 'refund_initiated' && (
            <div className="p-4 rounded-xl text-xs space-y-1 border" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', borderColor: 'var(--c-border)' }}>
              <p className="font-bold text-sm font-display">
                Return Status: {order.return_status.replace(/_/g, ' ').toUpperCase()}
              </p>
              {order.return_reason && (
                <p><span className="font-semibold">Reason:</span> {order.return_reason}</p>
              )}
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider font-display mb-2" style={{ color: 'var(--c-gold)' }}>
              Order Items
            </h4>
            {order.items.map((item) => (
              <div key={item.id || item.product_id} className="flex justify-between text-xs py-2 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-display" style={{ color: 'var(--c-text)' }}>
                    {item.product?.name || `Product (${item.product_id.slice(0, 8)})`}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--c-muted)' }}>x{item.quantity}</span>
                </div>
                <span className="font-bold font-display" style={{ color: 'var(--c-text)' }}>
                  {formatPrice(item.line_total_cents)}
                </span>
              </div>
            ))}
          </div>

          {/* Delivery Address Snapshot */}
          {order.shipping_address && (
            <div className="p-4 rounded-xl text-xs space-y-1 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
              <span className="font-bold block text-[11px] uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)' }}>
                Delivery Address Snapshot
              </span>
              <p className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{order.shipping_address.full_address}</p>
              <p style={{ color: 'var(--c-text-dim)' }}>
                {order.shipping_address.state} — {order.shipping_address.pin_code}
              </p>
              {order.shipping_address.phone && (
                <p className="flex items-center gap-1.5 pt-0.5" style={{ color: 'var(--c-muted)' }}>
                  <IconPhone className="w-3.5 h-3.5" />
                  <span>{order.shipping_address.phone}</span>
                </p>
              )}
            </div>
          )}

          {/* Timeline Component */}
          {!isPending && !isFailed && (
            <div>
              <CustomerOrderTimeline orderId={order.id} currentStatus={order.status} />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-between items-center pt-4 border-t gap-3" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              onClick={() => handleOpenFeedback(order.id, order.order_number)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              <span>Feedback</span>
            </button>

            <div className="flex items-center gap-3">
              {canCancel && (
                <button
                  onClick={() => handleOpenCancelModal(order.id, order.order_number, order.total_cents)}
                  className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                  style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}
                >
                  Cancel Order
                </button>
              )}

              {canReturn && (
                <button
                  onClick={() => handleOpenReturnModal(order.id, order.order_number, order.total_cents)}
                  className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                  style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border-soft)' }}
                >
                  Request Return
                </button>
              )}

              {isPending && (
                <button
                  onClick={() => onContinuePayment(order.id, order.total_cents)}
                  disabled={loadingPayment}
                  className="px-5 py-2 font-bold text-xs rounded-xl transition font-display cursor-pointer"
                  style={{ background: 'var(--c-gold)', color: '#0a0908' }}
                >
                  Continue Payment
                </button>
              )}

              {isFailed && (
                <button
                  onClick={() => onRetryPayment(order.id, order.total_cents)}
                  disabled={loadingPayment}
                  className="px-5 py-2 font-bold text-xs rounded-xl transition font-display cursor-pointer"
                  style={{ background: 'var(--c-gold)', color: '#0a0908' }}
                >
                  Retry Payment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cancellation Modal */}
        {cancelModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
              <div className="rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
                <div className="border-b pb-3" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>Cancel Order #{cancelModalState.orderNumber}</h3>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Please provide a reason for cancelling this order.</p>
                </div>

                {cancelError && (
                  <div className="p-3 text-xs font-bold rounded-xl border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border-soft)' }}>
                    {cancelError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold font-display" style={{ color: 'var(--c-text-dim)' }}>
                    Why do you want to cancel this order? <span style={{ color: 'var(--c-status-red-text)' }}>*</span>
                  </label>
                  <textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Please enter your cancellation reason..."
                    rows={3}
                    className="w-full text-xs p-3 rounded-xl outline-none"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancelModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 })}
                    disabled={submittingCancel}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
                  >
                    Keep Order
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancellation}
                    disabled={submittingCancel}
                    className="px-5 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
              <div className="rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
                <div className="border-b pb-3" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>Request Return for #{returnModalState.orderNumber}</h3>
                  <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Provide a reason for returning your delivered order.</p>
                </div>

                {returnError && (
                  <div className="p-3 text-xs font-bold rounded-xl border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border-soft)' }}>
                    {returnError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold font-display" style={{ color: 'var(--c-text-dim)' }}>
                    Why do you want to return this order? <span style={{ color: 'var(--c-gold)' }}>*</span>
                  </label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Enter return reason..."
                    rows={3}
                    className="w-full text-xs p-3 rounded-xl outline-none"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReturnModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 })}
                    disabled={submittingReturn}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReturn}
                    disabled={submittingReturn}
                    className="px-5 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                    style={{ background: 'var(--c-gold)', color: '#0a0908' }}
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

  // MAIN VIEW: CLEAN COMPACT ORDER LIST (ONE ROW PER ORDER)
  return (
    <div className="space-y-6 font-sans">
      {/* Title Bar */}
      <div className="flex justify-between items-center pb-2">
        <div className="flex items-center gap-2.5">
          <IconPackage className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl font-extrabold font-display tracking-tight" style={{ color: 'var(--c-text)' }}>
            Your Orders
          </h2>
        </div>
        <button
          onClick={fetchOrders}
          className="px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 font-display cursor-pointer"
          style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
        >
          <IconRefresh className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Orders List Container */}
      <div className="space-y-3">
        {ordersWithPayments.map(({ order, payment }) => {
          return (
            <div
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className="rounded-2xl p-4 sm:p-5 border themed transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              style={{
                background: 'var(--c-surface)',
                borderColor: 'var(--c-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-gold)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--c-border)';
                e.currentTarget.style.transform = '';
              }}
            >
              {/* Left Column: Order Number & Date */}
              <div className="space-y-1 min-w-0">
                <span className="font-mono text-sm font-bold block" style={{ color: 'var(--c-gold)' }}>
                  ORD-{order.order_number}
                </span>
                <span className="text-xs block" style={{ color: 'var(--c-muted)' }}>
                  {formatDate(order.created_at)}
                </span>
              </div>

              {/* Middle & Right Information */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:gap-6">
                {/* Total Price */}
                <div className="sm:text-right">
                  <span className="text-[10px] font-semibold uppercase block font-display" style={{ color: 'var(--c-muted)' }}>
                    Total Amount
                  </span>
                  <span className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>
                    {formatPrice(order.total_cents)}
                  </span>
                </div>

                {/* Status Badge */}
                <div>
                  {renderStatusBadge(order, payment)}
                </div>

                {/* View Details Affordance */}
                <div className="flex items-center gap-1 text-xs font-bold font-display transition-colors" style={{ color: 'var(--c-gold)' }}>
                  <span>View Details</span>
                  <span className="text-base group-hover:translate-x-1 transition-transform">›</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
