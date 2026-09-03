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
      <div className="p-4 rounded-xl font-sans" style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-center py-3 text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>
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
      <div className="p-4 rounded-xl font-sans" style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
        <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Recommendations temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans themed">
      {/* AI Bundle Deal */}
      {bundle && bundle.products && bundle.products.length > 0 && (
        <div className="p-4 rounded-xl border shadow-xs space-y-3 themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-xs flex items-center gap-1.5 font-display" style={{ color: 'var(--c-text)' }}>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-display" style={{ background: 'var(--c-gold)', color: '#0a0908' }}>BUNDLE DEAL</span>
              <span>Recommended Combo</span>
            </h4>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded font-display" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
              SAVE {formatPrice(bundle.savings_cents)}
            </span>
          </div>

          <div className="space-y-1.5">
            {bundle.products.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex justify-between items-center text-xs p-2 rounded-lg border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                <span className="font-medium truncate max-w-[180px] font-display" style={{ color: 'var(--c-text)' }}>{item.name}</span>
                <span className="font-bold shrink-0 font-display" style={{ color: 'var(--c-text)' }}>{formatPrice(item.price_cents)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
            <div>
              <span className="text-[10px] block font-display" style={{ color: 'var(--c-muted)' }}>Combo Total:</span>
              <span className="line-through text-xs mr-1" style={{ color: 'var(--c-muted)' }}>{formatPrice(bundle.original_total_cents)}</span>
              <span className="text-sm font-extrabold font-display" style={{ color: 'var(--c-status-green-text)' }}>{formatPrice(bundle.final_total_cents)}</span>
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
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-xs transition active:scale-95 flex items-center gap-1 font-display cursor-pointer"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              <IconTag className="w-3.5 h-3.5" />
              <span>Add Bundle</span>
            </button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <>
          <h3 className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
            COMPLEMENTARY ITEMS
          </h3>

          <div className="space-y-2.5">
            {products.map((product) => {
              const alreadyInCart = currentProductIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  onClick={(e) => !alreadyInCart && handleViewProduct(product, e)}
                  className="flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer themed"
                  style={{
                    background: 'var(--c-surface2)',
                    borderColor: 'var(--c-border)',
                    opacity: alreadyInCart ? 0.6 : 1,
                  }}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-bold font-display text-xs truncate" style={{ color: alreadyInCart ? 'var(--c-muted)' : 'var(--c-text)' }}>
                      {product.name}
                    </h4>
                    <p className="text-[11px] font-bold font-display mt-0.5" style={{ color: 'var(--c-gold)' }}>{formatPrice(product.price_cents)}</p>
                  </div>

                  {!alreadyInCart && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => handleViewProduct(product, e)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition font-display cursor-pointer"
                        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => handleAddToCart(product, recommendations[0]?.id || '', e)}
                        className="px-3 py-1 text-[11px] font-bold rounded-lg shadow-xs transition active:scale-95 flex items-center gap-1 font-display cursor-pointer"
                        style={{ background: 'var(--c-gold)', color: '#0a0908' }}
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
        <div className="text-[10px] p-2.5 rounded-lg border font-sans themed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
          <p className="font-bold mb-0.5 font-display" style={{ color: 'var(--c-text-dim)' }}>Recommendation Insights:</p>
          <p className="italic">{recommendations[0].reasoning.explanation}</p>
        </div>
      )}
    </div>
  );
}
