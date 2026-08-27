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
}

export default function CartRecommendations({
  cartId,
  currentProductIds,
  onAddToCart,
}: CartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch(getApiUrl(`/recommendations/carts/${cartId}`));
        const data = await response.json();

        if (!response.ok) {
          // Non-critical failure
          if (response.status === 404 || response.status === 503) {
            setLoading(false);
            return;
          }
          throw new Error(data.error || 'Failed to load recommendations');
        }

        setRecommendations(data.recommendations || []);
        setProducts(data.products || []);
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
      const response = await fetch(getApiUrl('/carts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, quantity: 1 }),
      });

      if (response.ok) {
        await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'added_to_cart' }),
        });
        onAddToCart?.(product.id);
      }
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
          <span className="text-gray-600">Checking complementary products...</span>
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

  if (products.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-500">No complementary products found.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-lg font-bold mb-4 text-gray-900">
        Complementary Products
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
                <h4 className={`font-medium ${alreadyInCart ? 'text-gray-500' : 'text-gray-900'}`}>
                  {product.name}
                </h4>
                {alreadyInCart && (
                  <span className="text-xs text-gray-500">Already in cart</span>
                )}
                <p className="text-sm text-gray-600 mt-1">{product.description?.substring(0, 100)}...</p>
                <p className="text-lg font-semibold text-blue-600 mt-2">{formatPrice(product.price_cents)}</p>
              </div>

              {!alreadyInCart && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTrackClick(recommendations[0]?.id || '')}
                    className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    View
                  </button>
                  <button
                    onClick={() => {
                      handleAddToCart(product, recommendations[0]?.id || '');
                      onAddToCart?.(product.id);
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recommendations[0]?.reasoning && (
        <div className="mt-4 text-xs text-gray-500">
          <p className="font-medium mb-1">AI Reasoning:</p>
          <p>{recommendations[0].reasoning.explanation}</p>
        </div>
      )}
    </div>
  );
}
