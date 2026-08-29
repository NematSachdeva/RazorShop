import { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import CartRecommendations from './CartRecommendations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cart: CartDTO;
  onAddToCart?: (productId: string) => Promise<void>;
  onUpdateQuantity: (productId: string, newQuantity: number) => Promise<void>;
  onRemoveItem: (productId: string) => Promise<void>;
  onAddBundleToCart: (recommendationId: string) => Promise<void>;
  onCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  onAddBundleToCart,
  onCheckout,
}: Props) {
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const handleQuantityChange = async (productId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty < 1) return;

    try {
      setUpdatingProductId(productId);
      await onUpdateQuantity(productId, newQty);
    } catch (err: any) {
      alert(err.message || 'Failed to update quantity');
    } finally {
      setUpdatingProductId(null);
    }
  };

  const items = cart.items || [];
  const subtotalCents = cart.subtotal_cents || 0;
  const discountCents = cart.discount_cents || 0;
  const discountPercent = cart.discount_percent || 0;
  const totalCents = cart.total_cents || Math.max(0, subtotalCents - discountCents);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛒</span>
              <h2 className="text-xl font-bold">Your Shopping Cart</h2>
              <span className="bg-blue-800 text-blue-100 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white font-bold text-xl p-1"
            >
              ✕
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {items.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <span className="text-4xl block mb-3">🛍️</span>
                <p className="text-gray-600 font-semibold text-lg">Your cart is empty</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">
                  Explore our catalog and add your favorite products.
                </p>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700 shadow"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const product = item.product || {};
                  const available = (product as any).inventory?.available ?? 99;
                  const isMax = item.quantity >= available;
                  const isUpdating = updatingProductId === item.product_id;

                  return (
                    <div
                      key={item.id || item.product_id}
                      className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow transition-all space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1">
                            {product.name || 'Product'}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {product.category || 'General'}
                          </span>
                        </div>
                        <span className="font-extrabold text-blue-700 text-base">
                          {formatPrice(item.line_total_cents || item.price_cents * item.quantity)}
                        </span>
                      </div>

                      {/* Quantity Controls & Remove Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">Qty:</span>
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            <button
                              disabled={isUpdating || item.quantity <= 1}
                              onClick={() => handleQuantityChange(item.product_id, item.quantity, -1)}
                              className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 disabled:opacity-30 text-sm font-bold"
                              title={item.quantity <= 1 ? 'Minimum quantity is 1' : 'Decrease quantity'}
                            >
                              -
                            </button>
                            <span className="px-3 text-xs font-bold text-gray-900 min-w-[24px] text-center">
                              {isUpdating ? '...' : item.quantity}
                            </span>
                            <button
                              disabled={isUpdating || isMax}
                              onClick={() => handleQuantityChange(item.product_id, item.quantity, 1)}
                              className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 disabled:opacity-30 text-sm font-bold"
                              title={isMax ? `Only ${available} available in stock` : 'Increase quantity'}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          disabled={isUpdating}
                          onClick={() => onRemoveItem(item.product_id)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      </div>

                      {isMax && (
                        <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                          Max available stock ({available}) reached.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cart Cross-sells & Bundles */}
            {items.length > 0 && (
              <div className="border-t pt-4">
                <CartRecommendations
                  cartId={cart.id}
                  currentProductIds={items.map((i) => i.product_id)}
                  onAddBundleToCart={onAddBundleToCart}
                  onAddToCart={onAddToCart}
                />
              </div>
            )}
          </div>

          {/* Sticky Footer Order Summary */}
          {items.length > 0 && (
            <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatPrice(subtotalCents)}</span>
              </div>

              {discountCents > 0 && (
                <div className="flex justify-between text-sm bg-green-50 p-2.5 rounded-lg border border-green-200">
                  <div className="flex items-center gap-1.5 text-green-800 font-bold">
                    <span>🎁</span>
                    <span>Bundle Discount ({discountPercent}% OFF)</span>
                  </div>
                  <span className="font-bold text-green-700">-{formatPrice(discountCents)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t">
                <span>Total Amount</span>
                <span className="text-xl text-blue-700">{formatPrice(totalCents)}</span>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onCheckout();
                }}
                className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
