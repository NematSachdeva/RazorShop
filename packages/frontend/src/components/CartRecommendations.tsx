import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import { IconPlus, IconTag } from './common/Icons';

interface Recommendation {
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

interface Product {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  category: string;
  image_url?: string;
}

interface CartRecommendationsProps {
  cartId: string;
  currentProductIds: string[];
  onAddToCart?: (productId: string) => void;
  onAddBundleToCart?: (recommendationId: string) => void;
  onSelectProduct?: (product: Product) => void;
}

export default function CartRecommendations({
  cartId,
  currentProductIds,
  onAddToCart,
  onAddBundleToCart,
  onSelectProduct,
}: CartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const response = await fetch(getApiUrl(`/recommendations/carts/${cartId}/recommendations`));
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
        console.warn('Failed to fetch cart recommendations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    if (cartId) {
      fetchRecommendations();
    }
  }, [cartId]);

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
      console.warn('Failed to track click:', err);
    }
  };

  const handleAddToCart = async (product: Product, recommendationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (recommendationId) {
        await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'added_to_cart' }),
        });
      }
      onAddToCart?.(product.id);
    } catch (err) {
      console.warn('Failed to add to cart:', err);
    }
  };

  const handleViewProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    handleTrackClick(recommendations[0]?.id || '');
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 font-sans">
        <div className="flex items-center justify-center py-3 text-xs text-gray-600 font-semibold">
          <div className="animate-spin mr-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span>Checking complementary deals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl font-sans">
        <p className="text-xs text-gray-500">Recommendations temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4 font-sans">
      {/* AI Bundle Deal */}
      {bundle && bundle.products && bundle.products.length > 0 && (
        <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-blue-900 text-xs flex items-center gap-1.5">
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">BUNDLE DEAL</span>
              <span>Recommended Combo</span>
            </h4>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
              SAVE {formatPrice(bundle.savings_cents)}
            </span>
          </div>

          <div className="space-y-1.5">
            {bundle.products.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-800 truncate max-w-[180px]">{item.name}</span>
                <span className="text-gray-600 font-bold shrink-0">{formatPrice(item.price_cents)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-blue-200">
            <div>
              <span className="text-[10px] text-gray-500 block">Combo Total:</span>
              <span className="line-through text-gray-400 text-xs mr-1">{formatPrice(bundle.original_total_cents)}</span>
              <span className="text-sm font-extrabold text-emerald-700">{formatPrice(bundle.final_total_cents)}</span>
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
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition active:scale-95 flex items-center gap-1"
            >
              <IconTag className="w-3.5 h-3.5" />
              <span>Add Bundle</span>
            </button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <>
          <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-gray-900">
            Complementary Items
          </h3>

          <div className="space-y-2.5">
            {products.map((product) => {
              const alreadyInCart = currentProductIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  onClick={(e) => !alreadyInCart && handleViewProduct(product, e)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    alreadyInCart
                      ? 'bg-gray-100 border-gray-200 opacity-60'
                      : 'bg-white border-gray-200 hover:border-blue-300 cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className={`font-semibold font-heading text-xs truncate ${alreadyInCart ? 'text-gray-500' : 'text-gray-900'}`}>
                      {product.name}
                    </h4>
                    <p className="text-[11px] font-bold font-price text-blue-600 mt-0.5">{formatPrice(product.price_cents)}</p>
                  </div>

                  {!alreadyInCart && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => handleViewProduct(product, e)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => handleAddToCart(product, recommendations[0]?.id || '', e)}
                        className="px-3 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs transition active:scale-95 flex items-center gap-1"
                      >
                        <IconPlus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {recommendations[0]?.reasoning && (
        <div className="text-[10px] text-gray-500 bg-white p-2.5 rounded-lg border border-gray-200">
          <p className="font-bold text-gray-700 mb-0.5">Recommendation Insights:</p>
          <p className="italic">{recommendations[0].reasoning.explanation}</p>
        </div>
      )}
    </div>
  );
}
