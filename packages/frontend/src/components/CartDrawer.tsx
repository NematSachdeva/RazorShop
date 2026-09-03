import React, { useState, useEffect } from 'react';
import { CartDTO } from '@razor/shared';
import CartRecommendations from './CartRecommendations';
import { IconCart, IconTag, IconArrowRight, IconTrash, IconPlus, IconMinus } from './common/Icons';

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

function ItemDealTimer({ expiresAtISO }: { expiresAtISO: string }) {
  const expiresAt = new Date(expiresAtISO).getTime();
  const [remainingMs, setRemainingMs] = useState<number>(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0) return null;

  const totalSecs = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span
      className="text-[10px] font-extrabold px-2 py-0.5 rounded inline-flex items-center gap-1 mt-1 font-display"
      style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', border: '1px solid var(--c-border)' }}
    >
      <span>⏱️ Offer expires in {pad(minutes)}:{pad(seconds)}</span>
    </span>
  );
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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fadeIn"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-screen max-w-md h-full flex flex-col shadow-2xl themed animate-fadeIn"
          style={{
            background: 'var(--c-surface)',
            borderLeft: '1px solid var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          {/* Header */}
          <div
            className="p-4 sm:p-6 flex justify-between items-baseline shrink-0 border-b"
            style={{ borderColor: 'var(--c-border)' }}
          >
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-xl font-bold" style={{ color: 'var(--c-text)' }}>
                Your Cart
              </h2>
              <span
                className="text-xs px-2.5 py-0.5 rounded font-extrabold font-display"
                style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)' }}
              >
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="nav-link text-xs tracking-wider uppercase font-display"
              aria-label="Close cart drawer"
            >
              Close
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {items.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl border space-y-3"
                style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'var(--c-surface)', color: 'var(--c-muted)' }}
                >
                  <IconCart className="w-6 h-6" />
                </div>
                <p className="font-display font-bold text-lg" style={{ color: 'var(--c-text)' }}>Empty.</p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--c-muted)' }}>
                  Add products to get started.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="mt-2 px-5 py-2.5 font-bold rounded-xl text-xs shadow-sm transition font-display cursor-pointer"
                  style={{ background: 'var(--c-gold)', color: '#0a0908' }}
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

                  const origPriceCents = product.original_price_cents ? Number(product.original_price_cents) : Number(item.price_cents);
                  const currentPriceCents = Number(item.price_cents);
                  const isDealActive = (product.deal_active || origPriceCents > currentPriceCents) && origPriceCents > currentPriceCents;
                  const itemDiscountPercent = product.discount_percent || Math.round((1 - currentPriceCents / origPriceCents) * 100);
                  const expiresAt = product.deal_expires_at;

                  return (
                    <div
                      key={item.id || item.product_id}
                      className="p-4 rounded-xl border space-y-3"
                      style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 font-display" style={{ color: 'var(--c-muted)' }}>
                            {product.category || 'General'}
                          </span>
                          <h4 className="font-semibold font-display text-sm sm:text-base break-words" style={{ color: 'var(--c-text)' }}>
                            {product.name || 'Product'}
                          </h4>
                          {isDealActive && expiresAt && (
                            <ItemDealTimer expiresAtISO={String(expiresAt)} />
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          {isDealActive ? (
                            <>
                              <span className="text-xs line-through font-medium" style={{ color: 'var(--c-muted)' }}>
                                {formatPrice(origPriceCents * item.quantity)}
                              </span>
                              <span className="font-extrabold font-display text-base" style={{ color: 'var(--c-status-green-text)' }}>
                                {formatPrice(item.line_total_cents || currentPriceCents * item.quantity)}
                              </span>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded mt-0.5 font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)' }}>
                                {itemDiscountPercent}% OFF
                              </span>
                            </>
                          ) : (
                            <span className="font-bold font-display text-sm sm:text-base" style={{ color: 'var(--c-text)' }}>
                              {formatPrice(item.line_total_cents || currentPriceCents * item.quantity)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls & Remove Action */}
                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>Qty:</span>
                          <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
                            <button
                              disabled={isUpdating || item.quantity <= 1}
                              onClick={(e) => handleQuantityChange(e, item.product_id, item.quantity, -1)}
                              className="p-1.5 disabled:opacity-30 transition cursor-pointer"
                              style={{ color: 'var(--c-muted)' }}
                              title={item.quantity <= 1 ? 'Minimum quantity is 1' : 'Decrease quantity'}
                            >
                              <IconMinus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold min-w-[24px] text-center" style={{ color: 'var(--c-text)' }}>
                              {isUpdating ? '...' : item.quantity}
                            </span>
                            <button
                              disabled={isUpdating || isMax}
                              onClick={(e) => handleQuantityChange(e, item.product_id, item.quantity, 1)}
                              className="p-1.5 disabled:opacity-30 transition cursor-pointer"
                              style={{ color: 'var(--c-muted)' }}
                              title={isMax ? `Only ${available} available in stock` : 'Increase quantity'}
                            >
                              <IconPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          disabled={isUpdating}
                          onClick={(e) => handleRemove(e, item.product_id)}
                          className="text-xs font-bold px-2 py-1 rounded transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          style={{ color: 'var(--c-status-red-text)' }}
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>

                      {isMax && (
                        <p className="text-[11px] font-semibold px-2 py-0.5 rounded border" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)', borderColor: 'var(--c-border)' }}>
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
              <div className="border-t pt-4" style={{ borderColor: 'var(--c-border)' }}>
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
            <div className="p-4 sm:p-6 border-t space-y-3 shrink-0" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <div className="flex justify-between text-xs sm:text-sm" style={{ color: 'var(--c-muted)' }}>
                <span>Subtotal</span>
                <span className="font-semibold" style={{ color: 'var(--c-text)' }}>{formatPrice(subtotalCents)}</span>
              </div>

              {discountCents > 0 && (
                <div className="flex justify-between text-xs sm:text-sm p-2.5 rounded-xl border" style={{ background: 'var(--c-status-green-bg)', borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--c-status-green-text)' }}>
                    <IconTag className="w-4 h-4" />
                    <span>Bundle Discount ({discountPercent}% OFF)</span>
                  </div>
                  <span className="font-bold" style={{ color: 'var(--c-status-green-text)' }}>-{formatPrice(discountCents)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black pt-2 border-t" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
                <span>Total Amount</span>
                <span className="text-lg sm:text-xl font-display font-bold" style={{ color: 'var(--c-text)' }}>{formatPrice(totalCents)}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  onCheckout();
                }}
                className="w-full py-3.5 px-6 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm font-display cursor-pointer"
                style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
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
