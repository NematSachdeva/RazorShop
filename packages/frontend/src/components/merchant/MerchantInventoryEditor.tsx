import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

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
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto font-sans animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto border border-gray-100"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg p-1 rounded-full hover:bg-gray-100 transition"
        >
          ✕
        </button>

        <h2 className="text-xl font-extrabold text-gray-900 mb-1">📦 Manage Stock Inventory</h2>
        <p className="text-xs font-bold text-blue-800 mb-4 break-words">{product.name}</p>

        {/* Current Inventory Summary Card */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 mb-5 grid grid-cols-3 text-center gap-2">
          <div>
            <span className="block text-[11px] text-gray-500 font-medium">On Hand</span>
            <span className="text-lg font-black text-gray-900">{currentOnHand}</span>
          </div>
          <div>
            <span className="block text-[11px] text-gray-500 font-medium">Reserved</span>
            <span className="text-lg font-black text-amber-600">{reserved}</span>
          </div>
          <div>
            <span className="block text-[11px] text-gray-500 font-medium">Available</span>
            <span className="text-lg font-black text-emerald-600">{product.inventory.available}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block font-bold text-gray-700 mb-2 uppercase tracking-wider text-[11px]">
              Select Adjustment Action
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction('add')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  action === 'add'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ➕ Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAction('remove')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  action === 'remove'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ➖ Remove
              </button>
              <button
                type="button"
                onClick={() => setAction('set')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  action === 'set'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ✏️ Set Exact
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
              Quantity to {action === 'add' ? 'Add' : action === 'remove' ? 'Remove' : 'Set'} *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow transition active:scale-98"
            >
              {loading ? 'Updating...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
