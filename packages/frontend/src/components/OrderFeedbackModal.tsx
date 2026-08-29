import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { authService } from '../services/authService';

interface OrderFeedbackModalProps {
  orderId: string;
  orderNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSaved: () => void;
}

export default function OrderFeedbackModal({
  orderId,
  orderNumber,
  isOpen,
  onClose,
  onFeedbackSaved,
}: OrderFeedbackModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [category, setCategory] = useState<string>('Overall Experience');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchExistingFeedback();
    }
  }, [isOpen, orderId]);

  const fetchExistingFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/orders/${orderId}/feedback`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.feedback) {
          setExistingFeedbackId(data.feedback.id);
          setRating(data.feedback.rating || 5);
          setComment(data.feedback.comment || '');
          setCategory(data.feedback.category || 'Overall Experience');
        }
      }
    } catch (err) {
      console.error('Error fetching order feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl(`/orders/${orderId}/feedback`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          rating,
          comment,
          category,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit feedback');
      }

      onFeedbackSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting feedback');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
        >
          ×
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">
          {existingFeedbackId ? 'Update Feedback' : 'Order Feedback'}
        </h3>
        <p className="text-xs text-gray-500 mb-4">Order #{orderNumber}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Overall Rating
            </label>
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-2xl focus:outline-none transition-transform hover:scale-110"
                >
                  <span
                    className={
                      (hoverRating || rating) >= star
                        ? 'text-amber-400 font-bold'
                        : 'text-gray-300'
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
              <span className="text-xs font-semibold text-gray-600 ml-2">
                {rating} of 5 stars
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Feedback Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Overall Experience">Overall Experience</option>
              <option value="Payment">Payment</option>
              <option value="Product">Product</option>
              <option value="Checkout">Checkout</option>
              <option value="Delivery">Delivery</option>
            </select>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : existingFeedbackId ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
