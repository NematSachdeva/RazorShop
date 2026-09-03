import { useEffect } from 'react';
import { ProductDTO } from '@razor/shared';
import { getImageUrl } from '../config/api';
import StockBadge, { getStockInfo } from './common/StockBadge';
import ProductRecommendations from './ProductRecommendations';
import { IconClose, IconCart } from './common/Icons';

interface Props {
  product: ProductDTO;
  onClose: () => void;
  onAddToCart: (productId: string) => void;
  onAddBundleToCart: (recommendationId: string) => void;
  onSelectProduct?: (product: ProductDTO) => void;
}

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAddBundleToCart,
  onSelectProduct,
}: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const available = product.inventory?.available ?? 10;
  const stockInfo = getStockInfo(available);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-8 relative my-auto max-h-[90vh] sm:max-h-[85vh] overflow-y-auto themed"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl transition-colors z-10 cursor-pointer"
          style={{
            background: 'var(--c-surface2)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-muted)',
          }}
          aria-label="Close detail modal"
        >
          <IconClose className="w-4 h-4" />
        </button>

        {/* Product Image Hero */}
        <div
          className="mb-6 h-64 sm:h-72 w-full overflow-hidden rounded-2xl flex items-center justify-center p-3 relative"
          style={{
            background: 'var(--c-surface2)',
            border: '1px solid var(--c-border)',
          }}
        >
          {getImageUrl(product.image_url || (product as any).imageUrl) ? (
            <img
              src={getImageUrl(product.image_url || (product as any).imageUrl)}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain transition-transform duration-300 opacity-90"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className="flex flex-col items-center justify-center space-y-1.5"
            style={{
              display: getImageUrl(product.image_url || (product as any).imageUrl) ? 'none' : 'flex',
              color: 'var(--c-muted)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-surface)' }}
            >
              📦
            </div>
            <span className="text-xs font-semibold">No image available</span>
          </div>
        </div>

        {/* Category & Title */}
        <div className="mb-4 pr-8">
          <span
            className="text-[10px] font-extrabold px-3 py-1 rounded uppercase tracking-wider font-display"
            style={{
              background: 'var(--c-gold-dim)',
              color: 'var(--c-gold)',
              border: '1px solid var(--c-gold)',
            }}
          >
            {product.category || 'General'}
          </span>
          <h2
            className="text-xl sm:text-3xl font-bold font-display tracking-tight mt-3 break-words"
            style={{ color: 'var(--c-text)' }}
          >
            {product.name}
          </h2>
        </div>

        {/* Price & Stock Badge */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b"
          style={{ borderColor: 'var(--c-border-soft)' }}
        >
          <div>
            <span
              className="text-2xl sm:text-3xl font-bold font-display"
              style={{ color: 'var(--c-text)' }}
            >
              ₹{(product.price_cents / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <StockBadge availableQuantity={available} />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h4
            className="text-xs font-semibold font-display uppercase tracking-wider mb-2"
            style={{ color: 'var(--c-muted)' }}
          >
            Product Overview
          </h4>
          <p
            className="leading-relaxed text-xs sm:text-sm break-words font-normal"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {product.description || 'No product description available.'}
          </p>
        </div>

        {/* Main Add to Cart CTA */}
        <div className="mb-8">
          <button
            disabled={!stockInfo.canAddToCart}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product.id);
            }}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 transition-all font-display cursor-pointer"
            style={{
              background: stockInfo.canAddToCart ? 'var(--c-gold)' : 'var(--c-surface2)',
              color: stockInfo.canAddToCart ? '#0a0908' : 'var(--c-muted)',
              border: stockInfo.canAddToCart ? 'none' : '1px solid var(--c-border)',
            }}
            onMouseEnter={(e) => {
              if (stockInfo.canAddToCart) e.currentTarget.style.background = 'var(--c-gold-lt)';
            }}
            onMouseLeave={(e) => {
              if (stockInfo.canAddToCart) e.currentTarget.style.background = 'var(--c-gold)';
            }}
          >
            <IconCart className="w-5 h-5" />
            <span>
              {stockInfo.canAddToCart
                ? `Add to Cart — ₹${(product.price_cents / 100).toFixed(2)}`
                : 'Out of Stock'}
            </span>
          </button>
        </div>

        {/* AI Recommendation & Bundle Section */}
        <div className="border-t pt-6" style={{ borderColor: 'var(--c-border-soft)' }}>
          <ProductRecommendations
            productId={product.id}
            onAddBundleToCart={onAddBundleToCart}
            onAddToCart={onAddToCart}
            onSelectProduct={onSelectProduct}
          />
        </div>
      </div>
    </div>
  );
}
