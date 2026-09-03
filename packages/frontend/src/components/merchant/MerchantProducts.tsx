import { useState, useEffect } from 'react';
import { getApiUrl, getImageUrl } from '../../config/api';
import { authService } from '../../services/authService';
import MerchantProductForm from './MerchantProductForm';
import MerchantInventoryEditor from './MerchantInventoryEditor';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price_cents: number;
  image_url?: string | null;
  created_at: string;
  inventory: {
    quantity_on_hand: number;
    reserved: number;
    available: number;
    units_sold: number;
    last_updated: string;
  };
}

export default function MerchantProducts() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getApiUrl('/merchant/products'), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load seller products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setIsFormOpen(true);
  };

  const handleManageInventory = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setIsInventoryOpen(true);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete/archive "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/merchant/products/${id}`), {
        method: 'DELETE',
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete product');
      }

      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Error deleting product');
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 shadow-xs space-y-6 themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>Catalog & Inventory Management</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Create and edit seller catalog products, manage stock levels, and monitor sales.
          </p>
        </div>
        <button
          onClick={handleAddProduct}
          className="px-4 py-2 font-bold rounded-xl shadow-xs flex items-center gap-2 text-xs font-display cursor-pointer transition"
          style={{ background: 'var(--c-gold)', color: '#0a0908' }}
        >
          <span>Add Product</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border text-xs font-bold" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', borderColor: 'var(--c-border)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Loading catalog products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 rounded-xl border space-y-3" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="font-bold text-base font-display" style={{ color: 'var(--c-text)' }}>No seller products listed yet.</p>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 font-bold rounded-xl text-xs font-display transition cursor-pointer"
            style={{ background: 'var(--c-gold)', color: '#0a0908' }}
          >
            Create Your First Product
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--c-border)' }}>
          <table className="w-full text-left text-xs">
            <thead className="border-b font-bold font-display uppercase tracking-wider" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
              <tr>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4 text-center">Stock on Hand</th>
                <th className="py-3.5 px-4 text-center">Reserved</th>
                <th className="py-3.5 px-4 text-center">Available</th>
                <th className="py-3.5 px-4 text-center">Sold</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => (
                <tr key={prod.id} className="border-b last:border-b-0 transition" style={{ borderColor: 'var(--c-border-soft)' }}>
                  <td className="py-3.5 px-4 font-bold flex items-center gap-3" style={{ color: 'var(--c-text)' }}>
                    {getImageUrl(prod.image_url) ? (
                      <img
                        src={getImageUrl(prod.image_url)}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded-lg border bg-black/40 shrink-0 opacity-90"
                        style={{ borderColor: 'var(--c-border)' }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border flex items-center justify-center text-xs shrink-0 font-bold" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
                        📦
                      </div>
                    )}
                    <div>
                      <div className="font-display text-sm">{prod.name}</div>
                      {prod.description && (
                        <span className="block text-[11px] font-normal truncate max-w-xs" style={{ color: 'var(--c-muted)' }}>
                          {prod.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)' }}>
                      {prod.category || 'General'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold font-display" style={{ color: 'var(--c-text)' }}>
                    ₹{(prod.price_cents / 100).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold" style={{ color: 'var(--c-text)' }}>
                    {prod.inventory?.quantity_on_hand ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-medium" style={{ color: 'var(--c-status-amber-text)' }}>
                    {prod.inventory?.reserved ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold" style={{ color: 'var(--c-status-green-text)' }}>
                    {prod.inventory?.available ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-center font-medium" style={{ color: 'var(--c-status-blue-text)' }}>
                    {prod.inventory?.units_sold ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleManageInventory(prod)}
                      className="px-2.5 py-1 rounded text-xs font-bold transition font-display cursor-pointer"
                      style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border)' }}
                      title="Adjust Inventory Stock"
                    >
                      📦 Stock
                    </button>
                    <button
                      onClick={() => handleEditProduct(prod)}
                      className="px-2.5 py-1 rounded text-xs font-bold transition font-display cursor-pointer"
                      style={{ background: 'var(--c-surface2)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
                      title="Edit Product Details"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id, prod.name)}
                      className="px-2.5 py-1 rounded text-xs font-bold transition font-display cursor-pointer"
                      style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border)' }}
                      title="Delete Product"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Add/Edit Modal */}
      {isFormOpen && (
        <MerchantProductForm
          product={selectedProduct}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            setIsFormOpen(false);
            setSelectedProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* Inventory Stock Adjustment Modal */}
      {isInventoryOpen && selectedProduct && (
        <MerchantInventoryEditor
          product={selectedProduct}
          onClose={() => {
            setIsInventoryOpen(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            setIsInventoryOpen(false);
            setSelectedProduct(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}
