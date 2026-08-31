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
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Merchant Order Fulfillment</h2>
          <p className="text-sm text-gray-600">
            View orders, manage customer return requests, and track fulfillment/return status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Filter by Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-semibold"
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-bold transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading merchant store orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-3">
          <h3 className="text-base font-bold text-gray-900">No merchant orders found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            When customers purchase products from your catalog, orders will appear here for fulfillment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const rawStatus = (order.status || 'pending').toLowerCase();
            const isCancelled = rawStatus === 'cancelled';
            const isPending = rawStatus === 'pending';
            const isConfirmed = rawStatus === 'confirmed';
            const isDispatched = rawStatus === 'dispatched' || rawStatus === 'shipped';
            const isDelivered = rawStatus === 'delivered' && (!order.return_status || order.return_status === 'none');

            const isReturnRequested = order.return_status === 'return_requested' || rawStatus === 'return_requested';
            const isReturnApproved = order.return_status === 'return_approved' || rawStatus === 'return_approved';
            const isReturnRejected = order.return_status === 'return_rejected' || rawStatus === 'return_rejected';
            const isPickupScheduled = order.return_status === 'pickup_scheduled' || rawStatus === 'pickup_scheduled';
            const isPickedUp = order.return_status === 'order_picked_up' || rawStatus === 'order_picked_up';
            const isReturnInTransit = order.return_status === 'return_in_transit' || rawStatus === 'return_in_transit';
            const isReturnedToSeller = order.return_status === 'order_returned_to_seller' || rawStatus === 'order_returned_to_seller';
            const isRefundInitiated = order.return_status === 'refund_initiated' || rawStatus === 'refund_initiated';

            const itemsList = order.merchant_items || order.items || [];

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl p-5 hover:border-gray-300 transition shadow-2xs space-y-4 font-sans ${
                  isCancelled ? 'border-rose-200 bg-rose-50/10' : isReturnRequested ? 'border-amber-200 bg-amber-50/10' : isRefundInitiated ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-gray-900">Order #{order.order_number}</span>

                      {/* Payment / Cancelled Status Badge */}
                      {isCancelled ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          Cancelled
                        </span>
                      ) : isPending ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Payment Pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Paid
                        </span>
                      )}

                      {/* Return Badges */}
                      {isReturnRequested && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Return Requested
                        </span>
                      )}
                      {isReturnApproved && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          Return Approved
                        </span>
                      )}
                      {isReturnRejected && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          Return Rejected
                        </span>
                      )}
                      {isPickupScheduled && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                          Pickup Scheduled
                        </span>
                      )}
                      {isPickedUp && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Order Picked Up
                        </span>
                      )}
                      {isReturnInTransit && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                          Return In Transit
                        </span>
                      )}
                      {isReturnedToSeller && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Returned to Seller
                        </span>
                      )}
                      {isRefundInitiated && (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Refund Initiated
                        </span>
                      )}

                      {!isCancelled && !order.return_status && (
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full border ${
                            isDelivered
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : isDispatched
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : isConfirmed
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          Status: {order.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      Placed on: {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-blue-700">
                      ₹{(order.merchant_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-[11px] text-gray-500 font-semibold">Your Store Revenue</p>
                  </div>
                </div>

                {/* Cancelled Info Bar */}
                {isCancelled && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1 text-rose-900">
                    <p className="font-extrabold text-rose-800">Cancelled by {order.cancelled_by || 'Customer'}</p>
                    {order.cancellation_reason && (
                      <p><span className="font-bold">Reason:</span> {order.cancellation_reason}</p>
                    )}
                    {order.cancellation_timestamp && (
                      <p className="text-[11px] text-rose-700 font-mono">Date: {new Date(order.cancellation_timestamp).toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Return Request Info Bar */}
                {order.return_status && order.return_status !== 'none' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
                    <p className="font-bold text-amber-900 text-sm">
                      Return Status: {order.return_status.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    {order.return_reason && (
                      <p><span className="font-bold">Reason:</span> {order.return_reason}</p>
                    )}
                    {order.return_requested_at && (
                      <p className="text-[11px] text-amber-800 font-mono">Requested At: {new Date(order.return_requested_at).toLocaleString()}</p>
                    )}
                    {order.return_rejection_reason && (
                      <p className="text-rose-700 font-medium"><span className="font-bold">Rejection Reason:</span> {order.return_rejection_reason}</p>
                    )}
                    {order.pickup_notes && (
                      <p className="text-amber-900"><span className="font-bold">Pickup Notes:</span> {order.pickup_notes}</p>
                    )}
                  </div>
                )}

                {/* Details Body */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* Customer & Shipping Address */}
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1.5">
                    <span className="font-extrabold text-gray-700 block text-[11px] uppercase tracking-wider">
                      Customer & Delivery Address
                    </span>
                    <p className="text-gray-900 font-bold">{order.customer?.name || 'Customer'}</p>
                    <p className="text-gray-600 font-medium">{order.customer?.email || 'N/A'}</p>

                    {order.shipping_address ? (
                      <div className="mt-2 pt-2 border-t border-gray-200/60 space-y-0.5 text-gray-700">
                        <p className="font-semibold text-gray-900">{order.shipping_address.full_address}</p>
                        <p className="text-gray-600">
                          {order.shipping_address.state} — {order.shipping_address.pin_code}
                        </p>
                        {order.shipping_address.phone && (
                          <p className="text-gray-500 font-medium">Phone: {order.shipping_address.phone}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-[11px] mt-1">No shipping address recorded</p>
                    )}
                  </div>

                  {/* Merchant Items Summary */}
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-2">
                    <span className="font-extrabold text-gray-700 block text-[11px] uppercase tracking-wider">
                      Merchant Catalog Items ({itemsList.length})
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {itemsList.map((item) => (
                        <div key={item.id || item.product_id} className="flex justify-between items-center text-gray-800">
                          <span className="font-medium truncate max-w-[220px]">
                            {item.quantity}x {item.name || 'Product'}
                          </span>
                          <span className="font-bold text-gray-900 shrink-0">
                            ₹{(item.line_total_cents / 100).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleOpenDetails(order)}
                    className="px-3.5 py-2 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                  >
                    View Full Details & Timeline
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Merchant Return Approval / Rejection Controls */}
                    {isReturnRequested && (
                      <>
                        <button
                          onClick={() => handleApproveReturn(order.id)}
                          disabled={actionLoading === order.id}
                          className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                        >
                          Approve Return
                        </button>
                        <button
                          onClick={() => {
                            setRejectionReason('');
                            setRejectModalState({ isOpen: true, orderId: order.id, orderNumber: order.order_number });
                          }}
                          disabled={actionLoading === order.id}
                          className="px-4 py-2 text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                        >
                          Reject Return
                        </button>
                      </>
                    )}

                    {/* Return Logistics Progression */}
                    {isReturnApproved && (
                      <button
                        onClick={() => {
                          setPickupNotesInput('');
                          setPickupModalState({ isOpen: true, orderId: order.id, orderNumber: order.order_number });
                        }}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        Schedule Pickup
                      </button>
                    )}

                    {isPickupScheduled && (
                      <button
                        onClick={() => handleUpdateLogistics(order.id, 'order_picked_up')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        Mark Picked Up
                      </button>
                    )}

                    {isPickedUp && (
                      <button
                        onClick={() => handleUpdateLogistics(order.id, 'return_in_transit')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        Mark Return In Transit
                      </button>
                    )}

                    {isReturnInTransit && (
                      <button
                        onClick={() => handleUpdateLogistics(order.id, 'order_returned_to_seller')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        Mark Returned to Seller
                      </button>
                    )}

                    {isReturnedToSeller && (
                      <button
                        onClick={() => handleOpenRefundModal(order.id, order.order_number, order.merchant_total_cents || order.total_cents)}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        Initiate Refund
                      </button>
                    )}

                    {/* Fulfillment Controls */}
                    {isConfirmed && !order.return_status && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'dispatched')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        {actionLoading === order.id ? 'Updating...' : 'Mark as Dispatched'}
                      </button>
                    )}

                    {isDispatched && !order.return_status && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        {actionLoading === order.id ? 'Updating...' : 'Mark as Delivered'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
              className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto my-auto font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Order #{selectedOrder.order_number}</h3>
                  <p className="text-xs text-gray-500 font-medium">Merchant Fulfillment Details & Activity Timeline</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center justify-between">
                  <span>{modalError}</span>
                  <button
                    onClick={() => handleOpenDetails(selectedOrder)}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-bold"
                  >
                    Retry
                  </button>
                </div>
              )}

              {modalLoading ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Loading full order details...</span>
                </div>
              ) : (
                <>
                  {/* Timeline Component */}
                  <OrderTimelineView timeline={orderTimeline} currentStatus={selectedOrder.status} />

                  {/* Cancellation Details Section (only when cancelled) */}
                  {selectedOrder.status === 'cancelled' && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1.5 text-xs text-rose-900">
                      <span className="font-extrabold text-rose-800 block uppercase tracking-wider text-[11px]">
                        Cancellation Audit Details
                      </span>
                      <p><span className="font-bold">Cancelled By:</span> {selectedOrder.cancelled_by || 'Customer'}</p>
                      {selectedOrder.cancellation_reason && (
                        <p><span className="font-bold">Reason:</span> {selectedOrder.cancellation_reason}</p>
                      )}
                      {selectedOrder.cancellation_timestamp && (
                        <p className="font-mono text-[11px] text-rose-700">Timestamp: {new Date(selectedOrder.cancellation_timestamp).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {/* Return Details Section (only when return is requested/active) */}
                  {selectedOrder.return_status && selectedOrder.return_status !== 'none' && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-1.5 text-xs text-amber-900">
                      <span className="font-extrabold text-amber-800 block uppercase tracking-wider text-[11px]">
                        Return Request & Logistics Details
                      </span>
                      <p><span className="font-bold">Status:</span> {selectedOrder.return_status.replace(/_/g, ' ').toUpperCase()}</p>
                      {selectedOrder.return_reason && (
                        <p><span className="font-bold">Return Reason:</span> {selectedOrder.return_reason}</p>
                      )}
                      {selectedOrder.return_requested_at && (
                        <p className="font-mono text-[11px] text-amber-800">Requested At: {new Date(selectedOrder.return_requested_at).toLocaleString()}</p>
                      )}
                      {selectedOrder.return_rejection_reason && (
                        <p className="text-rose-700 font-medium"><span className="font-bold">Rejection Reason:</span> {selectedOrder.return_rejection_reason}</p>
                      )}
                      {selectedOrder.pickup_notes && (
                        <p><span className="font-bold">Pickup Notes:</span> {selectedOrder.pickup_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Refund Details Section (only when refund is initiated or present) */}
                  {(selectedOrder.refund_status || selectedOrder.refund_initiated_at || selectedOrder.refund_amount_cents) && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1.5 text-xs text-emerald-900">
                      <span className="font-extrabold text-emerald-800 block uppercase tracking-wider text-[11px]">
                        Refund Audit Details
                      </span>
                      <p><span className="font-bold">Refund Status:</span> {selectedOrder.refund_status || 'Initiated'}</p>
                      {selectedOrder.refund_amount_cents && (
                        <p><span className="font-bold">Refund Amount:</span> ₹{(Number(selectedOrder.refund_amount_cents) / 100).toFixed(2)}</p>
                      )}
                      {selectedOrder.refund_initiated_at && (
                        <p className="font-mono text-[11px] text-emerald-700">Initiated At: {new Date(selectedOrder.refund_initiated_at).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {/* Shipping Address */}
                  {selectedOrder.shipping_address ? (
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-1 text-xs">
                      <span className="font-extrabold text-blue-900 block uppercase tracking-wider text-[11px]">
                        Delivery Address Snapshot
                      </span>
                      <p className="font-bold text-gray-900">{selectedOrder.shipping_address.full_address}</p>
                      <p className="text-gray-600">
                        {selectedOrder.shipping_address.state} — {selectedOrder.shipping_address.pin_code}
                      </p>
                      {selectedOrder.shipping_address.phone && (
                        <p className="text-gray-500 font-medium">Phone: {selectedOrder.shipping_address.phone}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-500 italic">
                      No shipping address snapshot attached to this order.
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                      Merchant Order Items ({ (selectedOrder.merchant_items || selectedOrder.items || []).length })
                    </h4>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                      {(selectedOrder.merchant_items || selectedOrder.items || []).length === 0 ? (
                        <p className="text-gray-500 italic text-center py-2">No merchant items found for this order.</p>
                      ) : (
                        (selectedOrder.merchant_items || selectedOrder.items || []).map((item) => (
                          <div key={item.id || item.product_id} className="flex justify-between items-center text-gray-900 py-1 border-b border-gray-200/50 last:border-0">
                            <div>
                              <span className="font-bold text-gray-900">{item.name || 'Product'}</span>
                              <span className="text-gray-500 ml-2 font-medium">x{item.quantity}</span>
                            </div>
                            <span className="font-extrabold text-gray-900">
                              ₹{(item.line_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))
                      )}

                      <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-sm font-black text-blue-700">
                        <span>Merchant Revenue Subtotal</span>
                        <span>₹{(selectedOrder.merchant_total_cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Controls */}
                  <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                    >
                      Close
                    </button>

                    <div className="flex items-center gap-2">
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
