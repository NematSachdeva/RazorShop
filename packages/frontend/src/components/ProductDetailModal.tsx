import { useEffect } from 'react';
import { ProductDTO } from '@razor/shared';
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
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-8 relative my-auto max-h-[90vh] sm:max-h-[85vh] overflow-y-auto border border-gray-100 font-sans"
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors z-10"
          aria-label="Close detail modal"
        >
          <IconClose className="w-4 h-4" />
        </button>

        {/* Category & Title */}
        <div className="mb-4 pr-8">
          <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {product.category || 'General'}
          </span>
          <h2 className="text-xl sm:text-3xl font-extrabold text-gray-900 mt-2 break-words">
            {product.name}
          </h2>
        </div>

        {/* Price & Stock Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div>
            <span className="text-2xl sm:text-3xl font-black text-blue-700">
              ₹{(product.price_cents / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <StockBadge availableQuantity={available} />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Product Overview
          </h4>
          <p className="text-gray-700 leading-relaxed text-xs sm:text-sm break-words">
            {product.description || 'High quality product carefully inspected for maximum value.'}
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
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base shadow-md flex items-center justify-center gap-2 transition-all ${
              stockInfo.canAddToCart
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg active:scale-[0.99]'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
            }`}
          >
            <IconCart className="w-5 h-5" />
            <span>{stockInfo.canAddToCart ? 'Add Product to Cart' : 'Out of Stock'}</span>
          </button>
        </div>

        {/* AI Recommendation & Bundle Section */}
        <div className="border-t border-gray-100 pt-6">
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
