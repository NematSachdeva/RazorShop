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
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    if (loading) return;
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl shadow-2xl w-full max-w-md p-6 relative border themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 text-lg font-bold p-1 rounded-full transition cursor-pointer"
          style={{ color: 'var(--c-muted)' }}
        >
          ✕
        </button>

        <h3 className="text-xl font-extrabold font-display mb-1" style={{ color: 'var(--c-text)' }}>
          {existingFeedbackId ? 'Update Feedback' : 'Order Feedback'}
        </h3>
        <p className="text-xs font-mono mb-4" style={{ color: 'var(--c-muted)' }}>Order #{orderNumber}</p>

        {error && (
          <div className="mb-4 p-3.5 text-xs font-semibold rounded-xl border" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Rating */}
          <div>
            <label className="block font-bold mb-2 uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-text-dim)' }}>
              Overall Rating
            </label>
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRating(star);
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-2xl focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                >
                  <span
                    style={{ color: (hoverRating || rating) >= star ? 'var(--c-gold)' : 'var(--c-faint)' }}
                  >
                    ★
                  </span>
                </button>
              ))}
              <span className="text-xs font-bold ml-2" style={{ color: 'var(--c-muted)' }}>
                {rating} of 5 stars
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block font-bold mb-1 uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-text-dim)' }}>
              Feedback Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl p-2.5 text-xs font-medium outline-none"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
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
            <label className="block font-bold mb-1 uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-text-dim)' }}>
              Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={3}
              className="w-full rounded-xl p-2.5 text-xs outline-none"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer font-display"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-extrabold rounded-xl transition cursor-pointer font-display"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              {loading ? 'Submitting...' : existingFeedbackId ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
