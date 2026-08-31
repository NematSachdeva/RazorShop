import { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import CartRecommendations from './CartRecommendations';
import { IconCart, IconClose, IconTag, IconArrowRight, IconTrash, IconPlus, IconMinus } from './common/Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cart: CartDTO;
  onAddToCart?: (productId: string) => Promise<void>;
  onUpdateQuantity: (productId: string, newQuantity: number) => Promise<void>;
  onRemoveItem: (productId: string) => Promise<void>;
  onAddBundleToCart: (recommendationId: string) => Promise<void>;
  onCheckout: () => void;
  onSelectProduct?: (product: any) => void;
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
  onSelectProduct,
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
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleQuantityChange = async (
    e: React.MouseEvent,
    productId: string,
    currentQty: number,
    delta: number
  ) => {
    e.stopPropagation();
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

  const handleRemove = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    try {
      setUpdatingProductId(productId);
      await onRemoveItem(productId);
    } catch (err: any) {
      alert(err.message || 'Failed to remove item');
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
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-fadeIn"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <IconCart className="w-6 h-6 text-white" />
              <h2 className="text-lg sm:text-xl font-bold">Your Shopping Cart</h2>
              <span className="bg-blue-800 text-blue-100 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-blue-100 hover:text-white font-bold p-1.5 rounded-full hover:bg-blue-700 transition-colors"
              aria-label="Close cart drawer"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {items.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                  <IconCart className="w-6 h-6" />
                </div>
                <p className="text-gray-800 font-bold text-base">Your cart is empty</p>
                <p className="text-gray-500 text-xs max-w-xs mx-auto">
                  Explore our catalog and add your favorite products.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="mt-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 shadow-sm transition"
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
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold font-heading text-gray-900 text-sm sm:text-base break-words">
                            {product.name || 'Product'}
                          </h4>
                          <span className="text-[11px] font-medium text-gray-500 block mt-0.5 font-body">
                            {product.category || 'General'}
                          </span>
                        </div>
                        <span className="font-bold font-price text-blue-700 text-sm sm:text-base shrink-0">
                          {formatPrice(item.line_total_cents || item.price_cents * item.quantity)}
                        </span>
                      </div>

                      {/* Quantity Controls & Remove Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">Qty:</span>
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            <button
                              disabled={isUpdating || item.quantity <= 1}
                              onClick={(e) => handleQuantityChange(e, item.product_id, item.quantity, -1)}
                              className="p-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition"
                              title={item.quantity <= 1 ? 'Minimum quantity is 1' : 'Decrease quantity'}
                            >
                              <IconMinus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold text-gray-900 min-w-[24px] text-center">
                              {isUpdating ? '...' : item.quantity}
                            </span>
                            <button
                              disabled={isUpdating || isMax}
                              onClick={(e) => handleQuantityChange(e, item.product_id, item.quantity, 1)}
                              className="p-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-30 transition"
                              title={isMax ? `Only ${available} available in stock` : 'Increase quantity'}
                            >
                              <IconPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          disabled={isUpdating}
                          onClick={(e) => handleRemove(e, item.product_id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 hover:bg-rose-50 rounded transition disabled:opacity-50 flex items-center gap-1"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>

                      {isMax && (
                        <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
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
              <div className="border-t border-gray-100 pt-4">
                <CartRecommendations
                  cartId={cart.id}
                  currentProductIds={items.map((i) => i.product_id)}
                  onAddBundleToCart={onAddBundleToCart}
                  onAddToCart={onAddToCart}
                  onSelectProduct={(p) => {
                    onClose();
                    onSelectProduct?.(p);
                  }}
                />
              </div>
            )}
          </div>

          {/* Sticky Footer Order Summary */}
          {items.length > 0 && (
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-200 space-y-3 shrink-0">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatPrice(subtotalCents)}</span>
              </div>

              {discountCents > 0 && (
                <div className="flex justify-between text-xs sm:text-sm bg-green-50 p-2.5 rounded-xl border border-green-200">
                  <div className="flex items-center gap-1.5 text-green-800 font-bold">
                    <IconTag className="w-4 h-4 text-green-700" />
                    <span>Bundle Discount ({discountPercent}% OFF)</span>
                  </div>
                  <span className="font-bold text-green-700">-{formatPrice(discountCents)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Amount</span>
                <span className="text-lg sm:text-xl text-blue-700 font-price font-bold">{formatPrice(totalCents)}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  onCheckout();
                }}
                className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 text-sm"
              >
                <span>Proceed to Checkout</span>
                <IconArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
