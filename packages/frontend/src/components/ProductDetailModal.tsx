import { useEffect } from 'react';
import { ProductDTO } from '@razor/shared';
import StockBadge, { getStockInfo } from './common/StockBadge';
import ProductRecommendations from './ProductRecommendations';

interface Props {
  product: ProductDTO;
  onClose: () => void;
  onAddToCart: (productId: string) => void;
  onAddBundleToCart: (recommendationId: string) => void;
}

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onAddBundleToCart,
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg transition-colors"
        >
          ✕
        </button>

        {/* Category & Title */}
        <div className="mb-4">
          <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            {product.category || 'General'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2">
            {product.name}
          </h2>
        </div>

        {/* Price & Stock Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b">
          <div>
            <span className="text-3xl font-black text-blue-700">
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
          <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
            {product.description || 'High quality product carefully inspected for maximum value.'}
          </p>
        </div>

        {/* Main Add to Cart CTA */}
        <div className="mb-8">
          <button
            disabled={!stockInfo.canAddToCart}
            onClick={() => onAddToCart(product.id)}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-base shadow-md flex items-center justify-center gap-2 transition-all ${
              stockInfo.canAddToCart
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg active:scale-[0.99]'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
            }`}
          >
            <span>🛒</span>
            <span>{stockInfo.canAddToCart ? 'Add Product to Cart' : 'Out of Stock'}</span>
          </button>
        </div>

        {/* AI Recommendation & Bundle Section */}
        <div className="border-t pt-6">
          <ProductRecommendations
            productId={product.id}
            onAddBundleToCart={onAddBundleToCart}
            onAddToCart={onAddToCart}
          />
        </div>
      </div>
    </div>
  );
}
