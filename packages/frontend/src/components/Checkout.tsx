import { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import { getApiUrl } from '../config/api';
import { CustomerAddress, frontendAddressService } from '../services/addressService';
import { AddressFormModal } from './common/AddressFormModal';

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

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const loadCustomerAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const data = await frontendAddressService.listAddresses();
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddr = data.find((a) => a.is_default) || data[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (err) {
      console.error('Failed to load saved addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadCustomerAddresses();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isAddressModalOpen) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isAddressModalOpen]);

  const handleCreateOrder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || orderCreationAttempted) {
      return;
    }

    if (!cart.id) {
      setError('Cart is invalid');
      return;
    }

    if (!selectedAddress) {
      setError('Please add or select a delivery address before checkout');
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
          shipping_address: {
            full_address: selectedAddress.full_address,
            state: selectedAddress.state,
            pin_code: selectedAddress.pin_code,
            phone: selectedAddress.phone,
          },
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
    <>
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto border border-gray-100 space-y-5"
        >
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-tight text-gray-900">Checkout</h2>
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

          {/* Delivery Address Selection */}
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>📍</span> Delivery Address
              </span>
              <button
                onClick={() => setIsAddressModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
              >
                + Add New
              </button>
            </div>

            {loadingAddresses ? (
              <p className="text-xs text-gray-500 py-1">Loading saved addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-2 space-y-2">
                <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                  No saved delivery address found. Please add one to continue.
                </p>
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  + Add Delivery Address
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                      selectedAddress?.id === addr.id
                        ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                        : 'bg-white/60 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery_address"
                      checked={selectedAddress?.id === addr.id}
                      onChange={() => setSelectedAddress(addr)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{addr.full_address}</span>
                        {addr.is_default && (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mt-0.5">
                        {addr.state} — {addr.pin_code}
                      </p>
                      {addr.phone && <p className="text-gray-500 text-[11px]">📞 {addr.phone}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Order Details */}
          <div>
            <span className="font-bold text-xs text-gray-500 uppercase tracking-wider block mb-2">Order Items</span>
            <div className="bg-gray-50 p-3.5 rounded-xl max-h-48 overflow-y-auto border border-gray-100 space-y-2.5">
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex justify-between items-start text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-gray-500 font-medium">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-bold font-price text-gray-900 shrink-0">{formatPrice(item.line_total_cents)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-3 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <p>Subtotal:</p>
              <p className="font-semibold font-price">{formatPrice(cart.subtotal_cents || cart.total_cents)}</p>
            </div>

            {((cart.discount_cents && cart.discount_cents > 0) || (cart.discount_percent && cart.discount_percent > 0)) && (
              <div className="flex justify-between text-xs text-green-700 bg-green-50 p-2.5 rounded-xl border border-green-200 font-medium">
                <p>🎁 Combo Discount ({cart.discount_percent}% OFF):</p>
                <p className="font-bold font-price">-{formatPrice(cart.discount_cents || 0)}</p>
              </div>
            )}

            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
              <p>Total Amount:</p>
              <p className="text-blue-700 font-price font-bold">{formatPrice(cart.total_cents)}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              disabled={loading || !selectedAddress}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 text-xs sm:text-sm shadow-md transition disabled:opacity-50 active:scale-98"
            >
              {loading ? 'Creating Order...' : 'Proceed to Payment'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500 text-center">
            🔒 Secure payment via Razorpay.
          </p>
        </div>
      </div>

      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSave={async (payload) => {
          await frontendAddressService.createAddress(payload);
          await loadCustomerAddresses();
        }}
      />
    </>
  );
}
