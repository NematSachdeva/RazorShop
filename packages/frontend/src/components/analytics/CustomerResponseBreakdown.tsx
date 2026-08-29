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
      color: 'bg-green-100 border-green-300 text-green-700',
      icon: '✅',
    },
    {
      label: 'Refused',
      count: breakdown.refused,
      percentage: breakdown.percentages.refused,
      color: 'bg-red-100 border-red-300 text-red-700',
      icon: '❌',
    },
    {
      label: 'Promised',
      count: breakdown.promised,
      percentage: breakdown.percentages.promised,
      color: 'bg-blue-100 border-blue-300 text-blue-700',
      icon: '🤝',
    },
    {
      label: 'Unclear',
      count: breakdown.unclear,
      percentage: breakdown.percentages.unclear,
      color: 'bg-gray-100 border-gray-300 text-gray-700',
      icon: '❓',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Response & Feedback</h2>
          <p className="text-xs text-gray-500">Real-time recovery intents and post-purchase customer ratings</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="border border-gray-300 rounded-lg text-xs p-2 focus:ring-2 focus:ring-blue-500"
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
            className="border border-gray-300 rounded-lg text-xs p-2 focus:ring-2 focus:ring-blue-500"
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
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Recovery Communication Intents</h3>
          {breakdown.total === 0 ? (
            <p className="text-xs text-gray-500 py-4">No recovery communication responses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((response, idx) => (
                <div key={idx} className={`border-l-4 rounded-lg p-3 ${response.color}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{response.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{response.label}</p>
                        <p className="text-xs opacity-75">{response.count} responses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold">{response.percentage}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Rating & Feedback Overview */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Store Feedback & Satisfaction</h3>
          {loadingFeedback ? (
            <p className="text-xs text-gray-500 py-4">Loading customer feedback statistics...</p>
          ) : feedback ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                <div className="text-center pr-4 border-r">
                  <p className="text-3xl font-extrabold text-gray-900">{feedback.average_rating || '5.0'}</p>
                  <p className="text-xs text-amber-500">★★★★★</p>
                  <p className="text-[10px] text-gray-500 mt-1">{feedback.total_feedbacks} ratings</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = feedback.rating_distribution[star] || 0;
                    const pct = feedback.total_feedbacks > 0 ? (count / feedback.total_feedbacks) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center text-xs gap-2">
                        <span className="w-8 text-gray-600 font-medium">{star} ★</span>
                        <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-gray-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 py-4">No customer feedback submitted yet.</p>
          )}
        </div>
      </div>

      {/* Recent Feedback Comments List */}
      {feedback && feedback.recent_feedbacks.length > 0 && (
        <div className="pt-4 border-t space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Recent Customer Reviews</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {feedback.recent_feedbacks.map((fb) => (
              <div key={fb.id} className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{fb.customer_name}</span>
                    <span className="text-amber-500 font-bold">{'★'.repeat(fb.rating)}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">{fb.category}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">Order #{fb.order_number || fb.order_id.slice(0, 8)}</span>
                </div>
                {fb.comment && <p className="text-gray-600 italic">"{fb.comment}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
