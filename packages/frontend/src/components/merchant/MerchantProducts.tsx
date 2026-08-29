import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import MerchantProductForm from './MerchantProductForm';
import MerchantInventoryEditor from './MerchantInventoryEditor';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price_cents: number;
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
        throw new Error('Failed to load merchant products');
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
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📦 Catalog & Inventory Management</h2>
          <p className="text-sm text-gray-600">
            Create and edit store catalog products, manage stock levels, and monitor sales.
          </p>
        </div>
        <button
          onClick={handleAddProduct}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <span>➕</span> Add Product
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading catalog products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-600 font-medium mb-3">No merchant products listed yet.</p>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Create Your First Product
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4 text-center">Stock on Hand</th>
                <th className="py-3 px-4 text-center">Reserved</th>
                <th className="py-3 px-4 text-center">Available</th>
                <th className="py-3 px-4 text-center">Sold</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((prod) => (
                <tr key={prod.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {prod.name}
                    {prod.description && (
                      <span className="block text-xs text-gray-500 font-normal truncate max-w-xs">
                        {prod.description}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {prod.category || 'General'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-blue-700">
                    ₹{(prod.price_cents / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {prod.inventory?.quantity_on_hand ?? 0}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-amber-600">
                    {prod.inventory?.reserved ?? 0}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-green-700">
                    {prod.inventory?.available ?? 0}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-purple-700">
                    {prod.inventory?.units_sold ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleManageInventory(prod)}
                      className="px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-semibold"
                      title="Adjust Inventory Stock"
                    >
                      📦 Stock
                    </button>
                    <button
                      onClick={() => handleEditProduct(prod)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold"
                      title="Edit Product Details"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id, prod.name)}
                      className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-semibold"
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
