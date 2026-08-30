import React, { useState, useEffect } from 'react';
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

      // Ensure merchant_items is populated seamlessly regardless of items vs merchant_items backend property
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

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Merchant Order Fulfillment</h2>
          <p className="text-sm text-gray-600">
            View orders containing products from your catalog and advance their fulfillment status.
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
            const isPending = rawStatus === 'pending';
            const isConfirmed = rawStatus === 'confirmed';
            const isDispatched = rawStatus === 'dispatched' || rawStatus === 'shipped';
            const isDelivered = rawStatus === 'delivered';

            const itemsList = order.merchant_items || order.items || [];

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition shadow-2xs space-y-4 font-sans"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-gray-900">Order #{order.order_number}</span>
                      
                      {/* Payment Status Badge */}
                      {isPending ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Payment Pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Paid
                        </span>
                      )}

                      {/* Fulfillment Status Badge */}
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
                        Fulfillment: {order.status}
                      </span>
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

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                        Awaiting Customer Payment
                      </span>
                    )}

                    {isConfirmed && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'dispatched')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        {actionLoading === order.id ? 'Updating...' : 'Mark as Dispatched'}
                      </button>
                    )}

                    {isDispatched && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        disabled={actionLoading === order.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                      >
                        {actionLoading === order.id ? 'Updating...' : 'Mark as Delivered'}
                      </button>
                    )}

                    {isDelivered && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                        Order Delivered
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn"
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
                    {selectedOrder.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'dispatched')}
                        disabled={actionLoading === selectedOrder.id}
                        className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                      >
                        {actionLoading === selectedOrder.id ? 'Updating...' : 'Mark as Dispatched'}
                      </button>
                    )}

                    {(selectedOrder.status === 'dispatched' || selectedOrder.status === 'shipped') && (
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
        </div>
      )}
    </div>
  );
};
