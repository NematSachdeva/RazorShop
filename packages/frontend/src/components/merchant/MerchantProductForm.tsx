import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface ProductData {
  id?: string;
  name: string;
  category: string;
  description: string;
  price_cents: number;
  initial_quantity?: number;
}

interface Props {
  product?: ProductData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MerchantProductForm({ product, onClose, onSuccess }: Props) {
  const isEditing = !!product?.id;
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || '');
  const [description, setDescription] = useState(product?.description || '');
  const [priceInr, setPriceInr] = useState(
    product ? (product.price_cents / 100).toString() : ''
  );
  const [initialQuantity, setInitialQuantity] = useState('10');
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

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategory(product.category || '');
      setDescription(product.description || '');
      setPriceInr((product.price_cents / 100).toString());
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    const priceNum = parseFloat(priceInr);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }

    const quantityNum = parseInt(initialQuantity, 10);
    if (!isEditing && (isNaN(quantityNum) || quantityNum < 0)) {
      setError('Initial inventory must be >= 0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = isEditing
        ? getApiUrl(`/merchant/products/${product!.id}`)
        : getApiUrl('/merchant/products');
      const method = isEditing ? 'PUT' : 'POST';

      const payload = isEditing
        ? {
            name: name.trim(),
            category: category.trim() || 'General',
            description: description.trim(),
            price_cents: Math.round(priceNum * 100),
          }
        : {
            name: name.trim(),
            category: category.trim() || 'General',
            description: description.trim(),
            price_cents: Math.round(priceNum * 100),
            initial_quantity: quantityNum,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save product');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error saving product');
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
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 relative my-auto max-h-[90vh] overflow-y-auto border border-gray-100"
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

        <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-6">
          {isEditing ? '✏️ Edit Catalog Product' : '➕ Add New Catalog Product'}
        </h2>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ergonomic Wireless Keyboard"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Electronics"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
                Price (INR ₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={priceInr}
                onChange={(e) => setPriceInr(e.target.value)}
                placeholder="2999.00"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {!isEditing && (
            <div>
              <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
                Initial Stock Inventory *
              </label>
              <input
                type="number"
                min="0"
                required
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                placeholder="50"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 mb-1 uppercase tracking-wider text-[11px]">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product features and specifications..."
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
              {loading ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
