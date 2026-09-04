import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { IconClose } from '../common/Icons';

interface ProductItem {
  id: string;
  name: string;
  inventory: {
    quantity_on_hand: number;
    reserved: number;
    available: number;
  };
}

interface Props {
  product: ProductItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MerchantInventoryEditor({ product, onClose, onSuccess }: Props) {
  const [action, setAction] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currentOnHand = product.inventory.quantity_on_hand;
  const reserved = product.inventory.reserved;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Please enter a valid positive quantity number');
      return;
    }

    let projected = currentOnHand;
    if (action === 'add') projected += qtyNum;
    if (action === 'remove') projected -= qtyNum;
    if (action === 'set') projected = qtyNum;

    if (projected < 0) {
      setError('Total stock cannot become negative');
      return;
    }
    if (projected < reserved) {
      setError(`Stock cannot be reduced below reserved quantity (${reserved})`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getApiUrl(`/merchant/products/${product.id}/inventory`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          action,
          quantity: qtyNum,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update inventory');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error updating inventory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 relative my-auto max-h-[90vh] overflow-y-auto border themed"
        style={{
          background: 'var(--c-surface)',
          borderColor: 'var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-tight" style={{ color: 'var(--c-text)' }}>📦 Manage Stock Inventory</h2>
            <p className="text-xs font-bold font-display break-words mt-0.5" style={{ color: 'var(--c-gold)' }}>{product.name}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
            style={{
              background: 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-muted)',
            }}
            aria-label="Close inventory modal"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Current Inventory Summary Card */}
        <div
          className="p-4 rounded-xl border grid grid-cols-3 text-center gap-2 themed"
          style={{
            background: 'var(--c-surface2)',
            borderColor: 'var(--c-border)',
          }}
        >
          <div>
            <span className="block text-[11px] font-medium font-display mb-0.5" style={{ color: 'var(--c-muted)' }}>On Hand</span>
            <span className="text-lg font-black font-display" style={{ color: 'var(--c-text)' }}>{currentOnHand}</span>
          </div>
          <div>
            <span className="block text-[11px] font-medium font-display mb-0.5" style={{ color: 'var(--c-muted)' }}>Reserved</span>
            <span className="text-lg font-black font-display" style={{ color: 'var(--c-status-amber-text)' }}>{reserved}</span>
          </div>
          <div>
            <span className="block text-[11px] font-medium font-display mb-0.5" style={{ color: 'var(--c-muted)' }}>Available</span>
            <span className="text-lg font-black font-display" style={{ color: 'var(--c-status-green-text)' }}>{product.inventory.available}</span>
          </div>
        </div>

        {error && (
          <div
            className="p-3.5 rounded-xl text-xs font-semibold"
            style={{
              background: 'var(--c-status-red-bg)',
              border: '1px solid var(--c-border-soft)',
              color: 'var(--c-status-red-text)',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block font-bold mb-2 uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-text-dim)' }}>
              Select Adjustment Action
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction('add')}
                className="py-2 px-3 rounded-xl text-xs font-bold transition font-display cursor-pointer"
                style={{
                  background: action === 'add' ? 'var(--c-status-green-bg)' : 'var(--c-surface2)',
                  color: action === 'add' ? 'var(--c-status-green-text)' : 'var(--c-text-dim)',
                  border: `1px solid ${action === 'add' ? 'var(--c-status-green-text)' : 'var(--c-border)'}`,
                }}
              >
                ➕ Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAction('remove')}
                className="py-2 px-3 rounded-xl text-xs font-bold transition font-display cursor-pointer"
                style={{
                  background: action === 'remove' ? 'var(--c-status-amber-bg)' : 'var(--c-surface2)',
                  color: action === 'remove' ? 'var(--c-status-amber-text)' : 'var(--c-text-dim)',
                  border: `1px solid ${action === 'remove' ? 'var(--c-status-amber-text)' : 'var(--c-border)'}`,
                }}
              >
                ➖ Remove
              </button>
              <button
                type="button"
                onClick={() => setAction('set')}
                className="py-2 px-3 rounded-xl text-xs font-bold transition font-display cursor-pointer"
                style={{
                  background: action === 'set' ? 'var(--c-status-blue-bg)' : 'var(--c-surface2)',
                  color: action === 'set' ? 'var(--c-status-blue-text)' : 'var(--c-text-dim)',
                  border: `1px solid ${action === 'set' ? 'var(--c-status-blue-text)' : 'var(--c-border)'}`,
                }}
              >
                ✏️ Set Exact
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 uppercase tracking-wider text-[11px] font-display" style={{ color: 'var(--c-text-dim)' }}>
              Quantity to {action === 'add' ? 'Add' : action === 'remove' ? 'Remove' : 'Set'} *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all font-medium themed"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-2.5 text-xs font-bold rounded-xl transition font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 active:scale-98 font-display cursor-pointer"
              style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
            >
              {loading ? 'Updating...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
