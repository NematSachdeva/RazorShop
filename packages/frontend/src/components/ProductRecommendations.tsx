import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import { ProductDTO } from '@razor/shared';

interface ProductRecommendation {
  id: string;
  recommendation_type: string;
  reason: string;
  products: Array<{
    product_id: string;
    score: number;
    reason?: string;
  }>;
  reasoning?: {
    explanation: string;
    confidence: number;
    sources: string[];
  };
  metrics: {
    shown_count: number;
    clicked_count: number;
    added_to_cart_count: number;
  };
}

interface ProductRecommendationsProps {
  productId: string;
  className?: string;
  onAddToCart?: (productId: string) => void;
  onAddBundleToCart?: (recommendationId: string) => void;
  onSelectProduct?: (product: ProductDTO) => void;
}

export default function ProductRecommendations({
  productId,
  className = '',
  onAddToCart,
  onAddBundleToCart,
  onSelectProduct,
}: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const response = await fetch(getApiUrl(`/recommendations/products/${productId}/recommendations?limit=5`));
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404 || response.status === 503) {
            setLoading(false);
            return;
          }
          throw new Error(data.error || 'Failed to load recommendations');
        }

        const fetchedRecs = data.recommendations || [];
        setRecommendations(fetchedRecs);
        setProducts(data.products || []);
        setBundle(data.bundle || fetchedRecs[0]?.metadata?.bundle || null);

        // Track shown event
        if (fetchedRecs.length > 0 && fetchedRecs[0].id) {
          fetch(getApiUrl(`/recommendations/${fetchedRecs[0].id}/events`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'shown' }),
          }).catch((err) => console.warn('Failed to track shown event:', err));
        }
      } catch (err) {
        console.warn('Failed to fetch recommendations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchRecommendations();
    }
  }, [productId]);

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleTrackClick = async (recommendationId: string) => {
    try {
      if (!recommendationId) return;
      await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'clicked' }),
      });
    } catch (err) {
      console.warn('Failed to track click event:', err);
    }
  };

  const handleAddToCart = async (targetProductId: string, recommendationId: string) => {
    try {
      if (recommendationId) {
        await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'added_to_cart' }),
        });
      }
      onAddToCart?.(targetProductId);
    } catch (err) {
      console.warn('Failed to handle add to cart:', err);
    }
  };

  const handleViewProduct = (targetProduct: ProductDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    handleTrackClick(recommendations[0]?.id || '');
    if (onSelectProduct) {
      onSelectProduct(targetProduct);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-50 p-4 rounded-xl border border-gray-100 ${className}`}>
        <div className="flex items-center justify-center py-4 text-xs font-semibold text-gray-600">
          <div className="animate-spin mr-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span>Finding recommendations & deals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-50 p-4 rounded-xl ${className}`}>
        <p className="text-xs text-gray-500">Recommendations temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-100 ${className}`}>
      {/* Bundle Deal Card */}
      {bundle && bundle.products && bundle.products.length > 1 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h4 className="font-extrabold text-blue-900 text-sm flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">COMBO DEAL</span>
              ⚡ {bundle.title || 'Frequently Bought Together'}
            </h4>
            <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-md">
              SAVE {formatPrice(bundle.savings_cents)} ({bundle.discount_percent}% OFF)
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {bundle.products.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-800 truncate max-w-[200px] sm:max-w-xs">
                  {idx === 0 ? '🔹 ' + item.name + ' (This item)' : '➕ ' + item.name}
                </span>
                <span className="text-gray-700 font-bold shrink-0">{formatPrice(item.price_cents)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-blue-200 gap-3">
            <div>
              <span className="text-[11px] text-gray-500 block">Original combined price:</span>
              <span className="line-through text-gray-400 text-xs font-semibold mr-2">{formatPrice(bundle.original_total_cents)}</span>
              <span className="text-lg font-black text-green-700">{formatPrice(bundle.final_total_cents)}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (recommendations[0]?.id && onAddBundleToCart) {
                  onAddBundleToCart(recommendations[0].id);
                } else {
                  bundle.products.forEach((p: any) => onAddToCart?.(p.id));
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold rounded-xl shadow-md transition active:scale-95"
            >
              Add Bundle to Cart
            </button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <>
          <h3 className="text-sm font-extrabold mb-3 text-gray-900 uppercase tracking-wider">
            Frequently Bought Together / Complementary
          </h3>

          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={(e) => handleViewProduct(product, e)}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-white rounded-xl border border-gray-200 hover:border-blue-400 shadow-sm transition-all gap-3 cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                    {product.name}
                  </h4>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 break-words">
                      {product.description}
                    </p>
                  )}
                  <p className="text-sm font-extrabold text-blue-700 mt-1">{formatPrice(product.price_cents)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={(e) => handleViewProduct(product, e)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                  >
                    View Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product.id, recommendations[0]?.id || '');
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-95"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {recommendations[0]?.reasoning && (
        <div className="mt-4 text-[11px] text-gray-500 bg-white p-3 rounded-xl border border-gray-200">
          <p className="font-bold text-gray-700 mb-0.5">🤖 AI Recommendation Insights:</p>
          <p className="italic text-gray-600">{recommendations[0].reasoning.explanation}</p>
          <p className="mt-1 font-semibold text-purple-700">
            Confidence score: {(recommendations[0].reasoning.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  );
}
