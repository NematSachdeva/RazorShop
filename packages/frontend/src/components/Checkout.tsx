import { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import { getApiUrl } from '../config/api';
import { CustomerAddress, frontendAddressService } from '../services/addressService';
import { AddressFormModal } from './common/AddressFormModal';
import { IconClose } from './common/Icons';

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
        className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 relative my-auto max-h-[90vh] overflow-y-auto border themed"
          style={{
            background: 'var(--c-surface)',
            borderColor: 'var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
            <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-tight" style={{ color: 'var(--c-text)' }}>Checkout</h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="p-1.5 rounded-xl transition-colors cursor-pointer"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-muted)',
              }}
              aria-label="Close checkout modal"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery Address Selection */}
          <div className="p-4 rounded-xl border space-y-3 themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 font-display" style={{ color: 'var(--c-gold)' }}>
                <span>📍</span> Delivery Address
              </span>
              <button
                onClick={() => setIsAddressModalOpen(true)}
                className="text-xs font-bold underline font-display cursor-pointer"
                style={{ color: 'var(--c-gold)' }}
              >
                + Add New
              </button>
            </div>

            {loadingAddresses ? (
              <p className="text-xs py-1 font-medium" style={{ color: 'var(--c-muted)' }}>Loading saved addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-2 space-y-2">
                <p className="text-xs font-medium p-2.5 rounded-xl border font-display" style={{ background: 'var(--c-status-amber-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-amber-text)' }}>
                  No saved delivery address found. Please add one to continue.
                </p>
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full py-2 font-bold text-xs rounded-xl shadow-sm transition font-display cursor-pointer"
                  style={{ background: 'var(--c-gold)', color: '#0a0908' }}
                >
                  + Add Delivery Address
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition themed"
                    style={{
                      background: selectedAddress?.id === addr.id ? 'var(--c-gold-dim)' : 'var(--c-surface)',
                      borderColor: selectedAddress?.id === addr.id ? 'var(--c-gold)' : 'var(--c-border)',
                    }}
                  >
                    <input
                      type="radio"
                      name="delivery_address"
                      checked={selectedAddress?.id === addr.id}
                      onChange={() => setSelectedAddress(addr)}
                      className="mt-0.5 cursor-pointer"
                      style={{ accentColor: 'var(--c-gold)' }}
                    />
                    <div className="text-xs flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{addr.full_address}</span>
                        {addr.is_default && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-gold)' }}>
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-medium" style={{ color: 'var(--c-text-dim)' }}>
                        {addr.state} — {addr.pin_code}
                      </p>
                      {addr.phone && <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--c-muted)' }}>📞 {addr.phone}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Order Details */}
          <div>
            <span className="font-bold text-xs uppercase tracking-wider block mb-2 font-display" style={{ color: 'var(--c-muted)' }}>Order Items</span>
            <div className="p-3.5 rounded-xl max-h-48 overflow-y-auto border space-y-2.5 themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex justify-between items-start text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate font-display" style={{ color: 'var(--c-text)' }}>{item.product.name}</p>
                    <p className="font-medium" style={{ color: 'var(--c-muted)' }}>Qty: {item.quantity}</p>
                  </div>
                  <p className="font-bold font-price shrink-0" style={{ color: 'var(--c-text)' }}>{formatPrice(item.line_total_cents)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-2 text-xs sm:text-sm" style={{ borderColor: 'var(--c-border-soft)' }}>
            <div className="flex justify-between" style={{ color: 'var(--c-muted)' }}>
              <p>Subtotal:</p>
              <p className="font-semibold font-price" style={{ color: 'var(--c-text)' }}>{formatPrice(cart.subtotal_cents || cart.total_cents)}</p>
            </div>

            {((cart.discount_cents && cart.discount_cents > 0) || (cart.discount_percent && cart.discount_percent > 0)) && (
              <div className="flex justify-between text-xs p-2.5 rounded-xl border font-medium" style={{ background: 'var(--c-status-green-bg)', borderColor: 'var(--c-border-soft)', color: 'var(--c-status-green-text)' }}>
                <p>🎁 Combo Discount ({cart.discount_percent}% OFF):</p>
                <p className="font-bold font-price">-{formatPrice(cart.discount_cents || 0)}</p>
              </div>
            )}

            <div className="flex justify-between text-base font-black pt-2 border-t" style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
              <p>Total Amount:</p>
              <p className="font-price font-bold" style={{ color: 'var(--c-gold)' }}>{formatPrice(cart.total_cents)}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold" style={{ background: 'var(--c-status-red-bg)', border: '1px solid var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
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
              className="flex-1 py-3 px-4 font-bold rounded-xl text-xs sm:text-sm transition disabled:opacity-50 font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateOrder}
              disabled={loading || !selectedAddress}
              className="flex-1 py-3 px-4 font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 active:scale-98 font-display cursor-pointer"
              style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
            >
              {loading ? 'Creating Order...' : 'Proceed to Payment'}
            </button>
          </div>

          <p className="text-[11px] text-center font-medium" style={{ color: 'var(--c-muted)' }}>
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

