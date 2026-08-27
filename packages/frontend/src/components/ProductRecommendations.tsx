import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';

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

interface Product {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  category: string;
  image_url?: string;
}

interface ProductRecommendationsProps {
  productId: string;
  className?: string;
}

export default function ProductRecommendations({
  productId,
  className = '',
}: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch(getApiUrl(`/recommendations/products/${productId}?limit=5`));
        const data = await response.json();

        if (!response.ok) {
          // Non-critical failure - don't break the page
          if (response.status === 404 || response.status === 503) {
            setLoading(false);
            return;
          }
          throw new Error(data.error || 'Failed to load recommendations');
        }

        setRecommendations(data.recommendations || []);
        setProducts(data.products || []);
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
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const handleTrackClick = async (recommendationId: string) => {
    try {
      // Track the click event
      await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'clicked' }),
      });
    } catch (err) {
      console.warn('Failed to track click event:', err);
    }
  };

  const handleAddToCart = async (productId: string, recommendationId: string) => {
    try {
      const response = await fetch(getApiUrl('/carts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });

      if (response.ok) {
        // Track added_to_cart event
        await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'added_to_cart' }),
        });
      }
    } catch (err) {
      console.warn('Failed to add to cart:', err);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin mr-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span className="text-gray-600">Finding similar products...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
        <p className="text-sm text-gray-600">
          Recommendations temporarily unavailable. Try again later.
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
        <p className="text-sm text-gray-500">
          No similar products found at this time.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
      <h3 className="text-lg font-bold mb-4 text-gray-900">
        Similar Products
      </h3>

      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-start p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{product.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{product.description?.substring(0, 100)}...</p>
              <p className="text-lg font-semibold text-blue-600 mt-2">{formatPrice(product.price_cents)}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTrackClick(recommendations[0]?.id || '')}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
              >
                View
              </button>
              <button
                onClick={() => handleAddToCart(product.id, recommendations[0]?.id || '')}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {recommendations[0]?.reasoning && (
        <div className="mt-4 text-xs text-gray-500">
          <p className="font-medium mb-1">AI Reasoning:</p>
          <p>{recommendations[0].reasoning.explanation}</p>
          <p className="mt-1">Confidence: {(recommendations[0].reasoning.confidence * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}
