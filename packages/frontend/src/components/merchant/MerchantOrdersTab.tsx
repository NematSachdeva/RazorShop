import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { OrderTimelineView, TimelineEvent } from '../OrderTimelineView';

export interface MerchantOrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price_cents: number;
  line_total_cents: number;
}

export interface MerchantOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  updated_at?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  shipping_address?: {
    full_address: string;
    state: string;
    pin_code: string;
    phone?: string;
    name?: string;
  } | null;
  items_count?: number;
  merchant_items: MerchantOrderItem[];
  items?: MerchantOrderItem[];
  merchant_total_cents: number;
  order_total_cents?: number;
  total_cents: number;
  cancellation_reason?: string | null;
  cancellation_timestamp?: string | null;
  cancelled_by?: string | null;
  refund_amount_cents?: number | null;
  refund_status?: string | null;
  return_status?: string | null;
  return_reason?: string | null;
  return_requested_at?: string | null;
  return_approved_at?: string | null;
  return_rejected_at?: string | null;
  return_rejection_reason?: string | null;
  pickup_scheduled_at?: string | null;
  pickup_notes?: string | null;
  picked_up_at?: string | null;
  return_in_transit_at?: string | null;
  returned_to_seller_at?: string | null;
  refund_initiated_at?: string | null;
}

export const MerchantOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);
  const [orderTimeline, setOrderTimeline] = useState<TimelineEvent[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rejection modal state
  const [rejectModalState, setRejectModalState] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Pickup Scheduling Modal
  const [pickupModalState, setPickupModalState] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: '',
  });
  const [pickupNotesInput, setPickupNotesInput] = useState('');
  const [submittingPickup, setSubmittingPickup] = useState(false);

  // Initiate Refund Modal State
  const [refundModalState, setRefundModalState] = useState<{
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
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = statusFilter !== 'all'
        ? getApiUrl(`/merchant/orders?status=${statusFilter}`)
        : getApiUrl('/merchant/orders');

      const res = await fetch(url, {
        headers: { ...authService.getAuthHeader() },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load merchant orders');
      }

      const resData = await res.json();
      setOrders(resData.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedOrder) {
        setSelectedOrder(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder]);

  const handleOpenDetails = async (order: MerchantOrder) => {
    setSelectedOrder(order);
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetch(getApiUrl(`/merchant/orders/${order.id}`), {
        headers: { ...authService.getAuthHeader() },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch detailed order info');
      }

      const details: MerchantOrder & { timeline?: TimelineEvent[] } = await res.json();

      const safeItems = details.merchant_items || details.items || [];
      setSelectedOrder({
        ...details,
        merchant_items: safeItems,
      });
      setOrderTimeline(details.timeline || []);
    } catch (err: any) {
      console.error('Failed to load order details:', err);
      setModalError(err.message || 'Unable to load order details');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, targetStatus: 'dispatched' | 'delivered') => {
    try {
      setActionLoading(orderId);
      setError(null);

      const res = await fetch(getApiUrl(`/merchant/orders/${orderId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update order status');
      }

      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        await handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveReturn = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      setError(null);

      const res = await fetch(getApiUrl(`/merchant/orders/${orderId}/approve-return`), {
        method: 'POST',
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve return request');
      }

      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        await handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve return request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmRejectReturn = async () => {
    if (!rejectModalState.orderId) return;

    try {
      setSubmittingReject(true);
      setError(null);

      const res = await fetch(getApiUrl(`/merchant/orders/${rejectModalState.orderId}/reject-return`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject return request');
      }

      const rejectedOrderId = rejectModalState.orderId;
      setRejectModalState({ isOpen: false, orderId: '', orderNumber: '' });
      setRejectionReason('');
      await fetchOrders();

      if (selectedOrder && selectedOrder.id === rejectedOrderId) {
        await handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject return request');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleUpdateLogistics = async (
    orderId: string,
    targetStatus: 'pickup_scheduled' | 'order_picked_up' | 'return_in_transit' | 'order_returned_to_seller',
    pickupNotes?: string
  ) => {
    try {
      setActionLoading(orderId);
      setError(null);

      const res = await fetch(getApiUrl(`/merchant/orders/${orderId}/return-logistics`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          status: targetStatus,
          pickup_notes: pickupNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update return logistics');
      }

      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        await handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update return logistics');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmPickupSchedule = async () => {
    if (!pickupModalState.orderId) return;

    try {
      setSubmittingPickup(true);
      await handleUpdateLogistics(pickupModalState.orderId, 'pickup_scheduled', pickupNotesInput.trim());
      setPickupModalState({ isOpen: false, orderId: '', orderNumber: '' });
      setPickupNotesInput('');
    } finally {
      setSubmittingPickup(false);
    }
  };

  const handleOpenRefundModal = (orderId: string, orderNumber: string, totalCents: number) => {
    setRefundModalState({
      isOpen: true,
      orderId,
      orderNumber,
      totalCents,
    });
  };

  const handleConfirmInitiateRefund = async () => {
    if (!refundModalState.orderId) return;

    try {
      setSubmittingRefund(true);
      setError(null);

      const res = await fetch(getApiUrl(`/merchant/orders/${refundModalState.orderId}/initiate-refund`), {
        method: 'POST',
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to initiate refund');
      }

      const refundedOrderId = refundModalState.orderId;
      setRefundModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 });
      await fetchOrders();

      if (selectedOrder && selectedOrder.id === refundedOrderId) {
        await handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 space-y-6 shadow-xs themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>Seller Order Fulfillment</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            View orders, manage customer return requests, and track fulfillment/return status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-muted)' }}>Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl px-3.5 py-2 text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-amber-500 font-display"
            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
          >
            <option value="all">All Orders</option>
            <option value="confirmed">Confirmed / Paid</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="return_requested">Return Requested</option>
            <option value="return_approved">Return Approved</option>
            <option value="return_rejected">Return Rejected</option>
            <option value="pickup_scheduled">Pickup Scheduled</option>
            <option value="order_picked_up">Picked Up</option>
            <option value="return_in_transit">Return In Transit</option>
            <option value="order_returned_to_seller">Returned to Seller</option>
            <option value="refund_initiated">Refund Initiated</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2">
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 rounded-lg text-xs font-extrabold font-display transition cursor-pointer"
            style={{ background: 'var(--c-gold)', color: '#0a0908' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-16 rounded-2xl border flex flex-col items-center justify-center gap-2" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--c-gold)', borderTopColor: 'transparent' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Loading seller store orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border space-y-2" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <h3 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>No seller orders found</h3>
          <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--c-muted)' }}>
            When customers purchase products from your catalog, orders will appear here for fulfillment.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead className="border-b font-bold uppercase text-[10px] tracking-wider font-display" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
              <tr>
                <th className="py-3.5 px-4">ORDER NUMBER</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4">CUSTOMER</th>
                <th className="py-3.5 px-4">DATE</th>
                <th className="py-3.5 px-4 text-right">TOTAL</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const rawStatus = (order.status || 'pending').toLowerCase();
                const isCancelled = rawStatus === 'cancelled';
                const isPending = rawStatus === 'pending';

                const isReturnRequested = order.return_status === 'return_requested' || rawStatus === 'return_requested';
                const isReturnApproved = order.return_status === 'return_approved' || rawStatus === 'return_approved';
                const isReturnRejected = order.return_status === 'return_rejected' || rawStatus === 'return_rejected';
                const isPickupScheduled = order.return_status === 'pickup_scheduled' || rawStatus === 'pickup_scheduled';
                const isPickedUp = order.return_status === 'order_picked_up' || rawStatus === 'order_picked_up';
                const isReturnInTransit = order.return_status === 'return_in_transit' || rawStatus === 'return_in_transit';
                const isReturnedToSeller = order.return_status === 'order_returned_to_seller' || rawStatus === 'order_returned_to_seller';
                const isRefundInitiated = order.return_status === 'refund_initiated' || rawStatus === 'refund_initiated';

                return (
                  <tr
                    key={order.id}
                    onClick={() => handleOpenDetails(order)}
                    className="border-b last:border-b-0 hover:bg-amber-500/5 cursor-pointer transition select-none"
                    style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}
                  >
                    <td className="py-4 px-4 font-bold font-display" style={{ color: 'var(--c-gold)' }}>
                      ORD-{order.order_number}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}>
                            CANCELLED
                          </span>
                        ) : isPending ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border-soft)' }}>
                            PENDING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
                            PAID
                          </span>
                        )}

                        {isReturnRequested && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border-soft)' }}>
                            RETURN REQUESTED
                          </span>
                        )}
                        {isReturnApproved && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
                            RETURN APPROVED
                          </span>
                        )}
                        {isReturnRejected && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border-soft)' }}>
                            RETURN REJECTED
                          </span>
                        )}
                        {isPickupScheduled && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
                            PICKUP SCHEDULED
                          </span>
                        )}
                        {isPickedUp && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
                            PICKED UP
                          </span>
                        )}
                        {isReturnInTransit && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
                            RETURN IN TRANSIT
                          </span>
                        )}
                        {isReturnedToSeller && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
                            RETURNED TO SELLER
                          </span>
                        )}
                        {isRefundInitiated && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
                            REFUND INITIATED
                          </span>
                        )}

                        {!isCancelled && !order.return_status && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-status-blue-bg)', color: 'var(--c-status-blue-text)', border: '1px solid var(--c-border-soft)' }}>
                            {order.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-medium">
                      <p className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{order.customer?.name || 'Customer'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>{order.customer?.email || 'N/A'}</p>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px]" style={{ color: 'var(--c-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-4 px-4 text-right font-bold font-display text-sm" style={{ color: 'var(--c-text)' }}>
                      ₹{(order.merchant_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <span className="inline-block px-3 py-1.5 text-xs font-bold rounded-lg font-display transition" style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                        View Details →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 font-sans">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Reject Return #{rejectModalState.orderNumber}</h3>
                <p className="text-xs text-gray-500 font-medium">Provide a reason for rejecting the return request.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason for customer..."
                  rows={3}
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalState({ isOpen: false, orderId: '', orderNumber: '' })}
                  disabled={submittingReject}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectReturn}
                  disabled={submittingReject}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {submittingReject ? 'Rejecting...' : 'Reject Return'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Pickup Schedule Modal */}
      {pickupModalState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 font-sans">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Schedule Pickup #{pickupModalState.orderNumber}</h3>
                <p className="text-xs text-gray-500 font-medium">Enter courier details or pickup notes for the customer.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Pickup Details / Courier Notes</label>
                <textarea
                  value={pickupNotesInput}
                  onChange={(e) => setPickupNotesInput(e.target.value)}
                  placeholder="e.g. BlueDart pickup scheduled for 2 PM tomorrow..."
                  rows={3}
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPickupModalState({ isOpen: false, orderId: '', orderNumber: '' })}
                  disabled={submittingPickup}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPickupSchedule}
                  disabled={submittingPickup}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {submittingPickup ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Initiate Refund Confirmation Modal */}
      {refundModalState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 font-sans">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Initiate Refund for #{refundModalState.orderNumber}</h3>
                <p className="text-xs text-gray-500 font-medium">Confirm refund initiation for returned order.</p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span>Order Number:</span>
                  <span className="font-mono">#{refundModalState.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span>Refund Amount:</span>
                  <span className="text-sm text-emerald-700 font-black">₹{(refundModalState.totalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold">Payment Method:</span>
                  <span>Original Source Payment Method</span>
                </div>
                <p className="text-[11px] text-emerald-800 pt-2 border-t border-emerald-200 leading-relaxed">
                  Upon confirmation, the return status will update to <strong>Refund Initiated</strong> and an automated email notification will be generated via Groq AI and dispatched to the customer.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundModalState({ isOpen: false, orderId: '', orderNumber: '', totalCents: 0 })}
                  disabled={submittingRefund}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInitiateRefund}
                  disabled={submittingRefund}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {submittingRefund ? 'Initiating...' : 'Confirm Initiate Refund'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Order Detail Modal */}
      {selectedOrder &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn font-sans"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedOrder(null);
            }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto my-auto font-sans themed"
              style={{
                background: 'var(--c-surface)',
                borderColor: 'var(--c-border)',
                color: 'var(--c-text)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--c-border-soft)' }}>
                <div>
                  <h3 className="text-xl font-bold font-display" style={{ color: 'var(--c-text)' }}>Order #{selectedOrder.order_number}</h3>
                  <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Merchant Fulfillment Details & Activity Timeline</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-full transition cursor-pointer font-bold"
                  style={{ color: 'var(--c-muted)', background: 'var(--c-surface2)' }}
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div
                  className="p-3.5 border rounded-xl text-xs font-medium flex items-center justify-between"
                  style={{ background: 'var(--c-status-red-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-red-text)' }}
                >
                  <span>{modalError}</span>
                  <button
                    onClick={() => handleOpenDetails(selectedOrder)}
                    className="px-2.5 py-1 rounded font-bold transition"
                    style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {modalLoading ? (
                <div className="py-12 text-center flex flex-col items-center gap-2" style={{ color: 'var(--c-muted)' }}>
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Loading full order details...</span>
                </div>
              ) : (
                <>
                  {/* Timeline Component */}
                  <OrderTimelineView timeline={orderTimeline} currentStatus={selectedOrder.status} />

                  {/* Cancellation Details Section (only when cancelled) */}
                  {selectedOrder.status === 'cancelled' && (
                    <div
                      className="p-4 rounded-xl space-y-1.5 text-xs border"
                      style={{
                        background: 'var(--c-status-red-bg)',
                        borderColor: 'var(--c-border-soft)',
                        color: 'var(--c-status-red-text)',
                      }}
                    >
                      <span className="font-extrabold block uppercase tracking-wider text-[11px] font-display">
                        Cancellation Audit Details
                      </span>
                      <p><span className="font-bold">Cancelled By:</span> {selectedOrder.cancelled_by || 'Customer'}</p>
                      {selectedOrder.cancellation_reason && (
                        <p><span className="font-bold">Reason:</span> {selectedOrder.cancellation_reason}</p>
                      )}
                      {selectedOrder.cancellation_timestamp && (
                        <p className="font-mono text-[11px]" style={{ opacity: 0.9 }}>Timestamp: {new Date(selectedOrder.cancellation_timestamp).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {/* Return Details Section (only when return is requested/active) */}
                  {selectedOrder.return_status && selectedOrder.return_status !== 'none' && (
                    <div
                      className="p-4 rounded-xl space-y-1.5 text-xs border"
                      style={{
                        background: 'var(--c-status-amber-bg)',
                        borderColor: 'var(--c-border-soft)',
                        color: 'var(--c-status-amber-text)',
                      }}
                    >
                      <span className="font-extrabold block uppercase tracking-wider text-[11px] font-display">
                        Return Request & Logistics Details
                      </span>
                      <p><span className="font-bold">Status:</span> {selectedOrder.return_status.replace(/_/g, ' ').toUpperCase()}</p>
                      {selectedOrder.return_reason && (
                        <p><span className="font-bold">Return Reason:</span> {selectedOrder.return_reason}</p>
                      )}
                      {selectedOrder.return_requested_at && (
                        <p className="font-mono text-[11px]" style={{ opacity: 0.9 }}>Requested At: {new Date(selectedOrder.return_requested_at).toLocaleString()}</p>
                      )}
                      {selectedOrder.return_rejection_reason && (
                        <p style={{ color: 'var(--c-status-red-text)' }}><span className="font-bold">Rejection Reason:</span> {selectedOrder.return_rejection_reason}</p>
                      )}
                      {selectedOrder.pickup_notes && (
                        <p><span className="font-bold">Pickup Notes:</span> {selectedOrder.pickup_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Refund Details Section (only when refund is initiated or present) */}
                  {(selectedOrder.refund_status || selectedOrder.refund_initiated_at || selectedOrder.refund_amount_cents) && (
                    <div
                      className="p-4 rounded-xl space-y-1.5 text-xs border"
                      style={{
                        background: 'var(--c-status-green-bg)',
                        borderColor: 'var(--c-border-soft)',
                        color: 'var(--c-status-green-text)',
                      }}
                    >
                      <span className="font-extrabold block uppercase tracking-wider text-[11px] font-display">
                        Refund Audit Details
                      </span>
                      <p><span className="font-bold">Refund Status:</span> {selectedOrder.refund_status || 'Initiated'}</p>
                      {selectedOrder.refund_amount_cents && (
                        <p><span className="font-bold">Refund Amount:</span> ₹{(Number(selectedOrder.refund_amount_cents) / 100).toFixed(2)}</p>
                      )}
                      {selectedOrder.refund_initiated_at && (
                        <p className="font-mono text-[11px]" style={{ opacity: 0.9 }}>Initiated At: {new Date(selectedOrder.refund_initiated_at).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {/* Shipping Address */}
                  {selectedOrder.shipping_address ? (
                    <div
                      className="p-4 rounded-xl space-y-1 text-xs border"
                      style={{
                        background: 'var(--c-surface2)',
                        borderColor: 'var(--c-border-soft)',
                        color: 'var(--c-text)',
                      }}
                    >
                      <span className="font-extrabold block uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-gold)' }}>
                        Delivery Address Snapshot
                      </span>
                      <p className="font-bold" style={{ color: 'var(--c-text)' }}>{selectedOrder.shipping_address.full_address}</p>
                      <p style={{ color: 'var(--c-muted)' }}>
                        {selectedOrder.shipping_address.state} — {selectedOrder.shipping_address.pin_code}
                      </p>
                      {selectedOrder.shipping_address.phone && (
                        <p className="font-medium" style={{ color: 'var(--c-muted)' }}>Phone: {selectedOrder.shipping_address.phone}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="p-3 rounded-xl text-xs italic border"
                      style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}
                    >
                      No shipping address snapshot attached to this order.
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-muted)' }}>
                      Merchant Order Items ({ (selectedOrder.merchant_items || selectedOrder.items || []).length })
                    </h4>

                    <div
                      className="p-4 rounded-xl border space-y-2 text-xs"
                      style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border-soft)' }}
                    >
                      {(selectedOrder.merchant_items || selectedOrder.items || []).length === 0 ? (
                        <p className="italic text-center py-2" style={{ color: 'var(--c-muted)' }}>No merchant items found for this order.</p>
                      ) : (
                        (selectedOrder.merchant_items || selectedOrder.items || []).map((item) => (
                          <div
                            key={item.id || item.product_id}
                            className="flex justify-between items-center py-1 border-b last:border-0"
                            style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}
                          >
                            <div>
                              <span className="font-bold" style={{ color: 'var(--c-text)' }}>{item.name || 'Product'}</span>
                              <span className="ml-2 font-medium" style={{ color: 'var(--c-muted)' }}>x{item.quantity}</span>
                            </div>
                            <span className="font-extrabold font-display" style={{ color: 'var(--c-text)' }}>
                              ₹{(item.line_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))
                      )}

                      <div className="border-t pt-3 flex justify-between items-center text-sm font-bold font-display" style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-gold)' }}>
                        <span>Merchant Revenue Subtotal</span>
                        <span>₹{(selectedOrder.merchant_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Controls */}
                  <div className="pt-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--c-border-soft)' }}>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-2 text-xs font-bold rounded-xl transition font-display cursor-pointer"
                      style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                    >
                      Close
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedOrder.return_status === 'return_requested' && (
                        <>
                          <button
                            onClick={() => handleApproveReturn(selectedOrder.id)}
                            disabled={actionLoading === selectedOrder.id}
                            className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                          >
                            Approve Return
                          </button>
                          <button
                            onClick={() => {
                              const ord = selectedOrder;
                              setSelectedOrder(null);
                              setRejectionReason('');
                              setRejectModalState({ isOpen: true, orderId: ord.id, orderNumber: ord.order_number });
                            }}
                            disabled={actionLoading === selectedOrder.id}
                            className="px-4 py-2 text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                          >
                            Reject Return
                          </button>
                        </>
                      )}

                      {selectedOrder.return_status === 'return_approved' && (
                        <button
                          onClick={() => {
                            const ord = selectedOrder;
                            setSelectedOrder(null);
                            setPickupNotesInput('');
                            setPickupModalState({ isOpen: true, orderId: ord.id, orderNumber: ord.order_number });
                          }}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          Schedule Pickup
                        </button>
                      )}

                      {selectedOrder.return_status === 'pickup_scheduled' && (
                        <button
                          onClick={() => handleUpdateLogistics(selectedOrder.id, 'order_picked_up')}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          Mark Picked Up
                        </button>
                      )}

                      {selectedOrder.return_status === 'order_picked_up' && (
                        <button
                          onClick={() => handleUpdateLogistics(selectedOrder.id, 'return_in_transit')}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          Mark Return In Transit
                        </button>
                      )}

                      {selectedOrder.return_status === 'return_in_transit' && (
                        <button
                          onClick={() => handleUpdateLogistics(selectedOrder.id, 'order_returned_to_seller')}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          Mark Returned to Seller
                        </button>
                      )}

                      {selectedOrder.return_status === 'order_returned_to_seller' && (
                        <button
                          onClick={() => {
                            const ord = selectedOrder;
                            setSelectedOrder(null);
                            handleOpenRefundModal(ord.id, ord.order_number, ord.merchant_total_cents || ord.total_cents);
                          }}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          Initiate Refund
                        </button>
                      )}

                      {selectedOrder.status === 'confirmed' && !selectedOrder.return_status && (
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'dispatched')}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          {actionLoading === selectedOrder.id ? 'Updating...' : 'Mark as Dispatched'}
                        </button>
                      )}

                      {(selectedOrder.status === 'dispatched' || selectedOrder.status === 'shipped') && !selectedOrder.return_status && (
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                          disabled={actionLoading === selectedOrder.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                        >
                          {actionLoading === selectedOrder.id ? 'Updating...' : 'Mark as Delivered'}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
