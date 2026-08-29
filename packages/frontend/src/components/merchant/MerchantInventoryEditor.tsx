import { useState } from 'react';
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

  const currentOnHand = product.inventory.quantity_on_hand;
  const reserved = product.inventory.reserved;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-lg"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-2">📦 Manage Stock Inventory</h2>
        <p className="text-sm font-semibold text-blue-800 mb-4">{product.name}</p>

        {/* Current Inventory Summary Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-3 text-center gap-2">
          <div>
            <span className="block text-xs text-gray-500 font-medium">On Hand</span>
            <span className="text-lg font-bold text-gray-900">{currentOnHand}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 font-medium">Reserved</span>
            <span className="text-lg font-bold text-amber-600">{reserved}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 font-medium">Available</span>
            <span className="text-lg font-bold text-green-600">{product.inventory.available}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Adjustment Action
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction('add')}
                className={`py-2 px-3 rounded text-xs font-bold border ${
                  action === 'add'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ➕ Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAction('remove')}
                className={`py-2 px-3 rounded text-xs font-bold border ${
                  action === 'remove'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ➖ Remove Stock
              </button>
              <button
                type="button"
                onClick={() => setAction('set')}
                className={`py-2 px-3 rounded text-xs font-bold border ${
                  action === 'set'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ✏️ Set Exact
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to {action === 'add' ? 'Add' : action === 'remove' ? 'Remove' : 'Set'} *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
