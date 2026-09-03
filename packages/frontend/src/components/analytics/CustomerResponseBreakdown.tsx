import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface ResponseData {
  accepted: number;
  refused: number;
  promised: number;
  unclear: number;
  total: number;
  percentages: {
    accepted: number;
    refused: number;
    promised: number;
    unclear: number;
  };
}

interface CustomerResponseBreakdownProps {
  breakdown: ResponseData;
}

interface FeedbackData {
  total_feedbacks: number;
  average_rating: number;
  rating_distribution: Record<number, number>;
  category_breakdown: Record<string, number>;
  recent_feedbacks: Array<{
    id: string;
    order_id: string;
    order_number?: string;
    customer_name?: string;
    customer_email?: string;
    rating: number;
    comment: string | null;
    category: string;
    created_at: string;
  }>;
}

export default function CustomerResponseBreakdown({ breakdown }: CustomerResponseBreakdownProps) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);

  const fetchFeedback = async () => {
    setLoadingFeedback(true);
    try {
      let url = getApiUrl('/merchant/feedback');
      const params = new URLSearchParams();
      if (ratingFilter !== 'all') params.append('rating', ratingFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          ...authService.getAuthHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback(data);
      }
    } catch (err) {
      console.error('Error fetching merchant feedback breakdown:', err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [ratingFilter, categoryFilter]);

  const responses = [
    {
      label: 'Accepted',
      count: breakdown.accepted,
      percentage: breakdown.percentages.accepted,
      color: 'var(--c-status-green-bg)',
      textColor: 'var(--c-status-green-text)',
      icon: '✅',
    },
    {
      label: 'Refused',
      count: breakdown.refused,
      percentage: breakdown.percentages.refused,
      color: 'var(--c-status-red-bg)',
      textColor: 'var(--c-status-red-text)',
      icon: '❌',
    },
    {
      label: 'Promised',
      count: breakdown.promised,
      percentage: breakdown.percentages.promised,
      color: 'var(--c-status-blue-bg)',
      textColor: 'var(--c-status-blue-text)',
      icon: '🤝',
    },
    {
      label: 'Unclear',
      count: breakdown.unclear,
      percentage: breakdown.percentages.unclear,
      color: 'var(--c-surface2)',
      textColor: 'var(--c-muted)',
      icon: '❓',
    },
  ];

  return (
    <div
      className="rounded-2xl border p-6 space-y-6 shadow-xs themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
            Customer Response & Feedback
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Real-time recovery intents and post-purchase customer ratings
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="rounded-xl text-xs p-2.5 font-bold border focus:outline-none focus:ring-1 focus:ring-amber-500"
            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl text-xs p-2.5 font-bold border focus:outline-none focus:ring-1 focus:ring-amber-500"
            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
          >
            <option value="all">All Categories</option>
            <option value="Overall Experience">Overall Experience</option>
            <option value="Payment">Payment</option>
            <option value="Product">Product</option>
            <option value="Checkout">Checkout</option>
            <option value="Delivery">Delivery</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recovery Intent Breakdown */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2 font-display" style={{ color: 'var(--c-gold)', borderColor: 'var(--c-border)' }}>
            Recovery Communication Intents
          </h3>
          {breakdown.total === 0 ? (
            <p className="text-xs py-4" style={{ color: 'var(--c-muted)' }}>No recovery communication responses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((response, idx) => (
                <div
                  key={idx}
                  className="border rounded-xl p-3.5"
                  style={{ background: response.color, borderColor: 'var(--c-border)' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{response.icon}</span>
                      <div>
                        <p className="font-bold text-sm font-display" style={{ color: response.textColor }}>{response.label}</p>
                        <p className="text-xs font-medium" style={{ color: response.textColor, opacity: 0.8 }}>{response.count} responses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold font-display" style={{ color: response.textColor }}>{response.percentage}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Rating & Feedback Overview */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2 font-display" style={{ color: 'var(--c-gold)', borderColor: 'var(--c-border)' }}>
            Store Feedback & Satisfaction
          </h3>
          {loadingFeedback ? (
            <p className="text-xs py-4" style={{ color: 'var(--c-muted)' }}>Loading customer feedback statistics...</p>
          ) : feedback ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                <div className="text-center pr-4 border-r" style={{ borderColor: 'var(--c-border)' }}>
                  <p className="text-3xl font-bold font-display" style={{ color: 'var(--c-text)' }}>{feedback.average_rating || '5.0'}</p>
                  <p className="text-xs text-amber-500 mt-0.5">★★★★★</p>
                  <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--c-muted)' }}>{feedback.total_feedbacks} ratings</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = feedback.rating_distribution[star] || 0;
                    const pct = feedback.total_feedbacks > 0 ? (count / feedback.total_feedbacks) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center text-xs gap-2">
                        <span className="w-8 font-medium" style={{ color: 'var(--c-muted)' }}>{star} ★</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--c-gold)' }} />
                        </div>
                        <span className="w-6 text-right text-[10px]" style={{ color: 'var(--c-muted)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs py-4" style={{ color: 'var(--c-muted)' }}>No customer feedback submitted yet.</p>
          )}
        </div>
      </div>

      {/* Recent Feedback Comments List */}
      {feedback && feedback.recent_feedbacks.length > 0 && (
        <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--c-border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)' }}>Recent Customer Reviews</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {feedback.recent_feedbacks.map((fb) => (
              <div key={fb.id} className="p-3 rounded-xl border text-xs space-y-1" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--c-text)' }}>{fb.customer_name}</span>
                    <span className="text-amber-500 font-bold">{'★'.repeat(fb.rating)}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)' }}>{fb.category}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Order #{fb.order_number || fb.order_id.slice(0, 8)}</span>
                </div>
                {fb.comment && <p className="italic" style={{ color: 'var(--c-text-dim)' }}>"{fb.comment}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
