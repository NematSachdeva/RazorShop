import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';

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
}

export default function CartRecommendations({
  cartId,
  currentProductIds,
  onAddToCart,
  onAddBundleToCart,
}: CartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
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
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
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

  const handleAddToCart = async (product: Product, recommendationId: string) => {
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

  if (loading) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin mr-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span className="text-gray-600">Checking complementary deals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600">Recommendations temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      {/* AI Bundle Deal */}
      {bundle && bundle.products && bundle.products.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-purple-900 text-sm flex items-center gap-1.5">
              <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">BUNDLE DEAL</span>
              🎁 AI Recommended Combo
            </h4>
            <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
              SAVE {formatPrice(bundle.savings_cents)}
            </span>
          </div>

          <div className="space-y-1.5 my-3">
            {bundle.products.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-100">
                <span className="font-medium text-gray-800">➕ {item.name}</span>
                <span className="text-gray-600 font-semibold">{formatPrice(item.price_cents)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-purple-200">
            <div>
              <span className="text-[11px] text-gray-500 block">Combo Total:</span>
              <span className="line-through text-gray-400 text-xs mr-1.5">{formatPrice(bundle.original_total_cents)}</span>
              <span className="text-base font-extrabold text-green-700">{formatPrice(bundle.final_total_cents)}</span>
            </div>
            <button
              onClick={() => {
                if (recommendations[0]?.id && onAddBundleToCart) {
                  onAddBundleToCart(recommendations[0].id);
                } else {
                  bundle.products.forEach((p: any) => onAddToCart?.(p.id));
                }
              }}
              className="px-3.5 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-md hover:bg-purple-700 shadow"
            >
              Add Bundle
            </button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <>
          <h3 className="text-sm font-bold mb-3 text-gray-900">
            Complementary Items
          </h3>

          <div className="space-y-3">
            {products.map((product) => {
              const alreadyInCart = currentProductIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className={`flex items-start p-3 rounded-lg border ${
                    alreadyInCart ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${alreadyInCart ? 'text-gray-500' : 'text-gray-900'}`}>
                      {product.name}
                    </h4>
                    {alreadyInCart && (
                      <span className="text-xs text-gray-500">Already in cart</span>
                    )}
                    <p className="text-xs text-gray-600 mt-1">{product.description?.substring(0, 80)}...</p>
                    <p className="text-sm font-bold text-blue-600 mt-1.5">{formatPrice(product.price_cents)}</p>
                  </div>

                  {!alreadyInCart && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleTrackClick(recommendations[0]?.id || '')}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          handleAddToCart(product, recommendations[0]?.id || '');
                        }}
                        className="px-2.5 py-1 text-xs bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
                      >
                        Add
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
        <div className="mt-3 text-[11px] text-gray-500">
          <p className="font-medium mb-0.5">AI Reasoning:</p>
          <p>{recommendations[0].reasoning.explanation}</p>
        </div>
      )}
    </div>
  );
}
