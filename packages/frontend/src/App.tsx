import { useEffect, useState } from 'react';
import { getApiUrl } from './config/api';
import { ProductDTO, CartDTO, CartItemDTO, ProductListResponse } from '@razor/shared';
import Checkout from './components/Checkout';
import PaymentPage from './components/PaymentPage';
import OrderConfirmation from './components/OrderConfirmation';
import LoginPage from './components/LoginPage';
import { authService } from './services/authService';

type ViewState = 'browse' | 'checkout' | 'payment' | 'confirmation';

export default function App() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartDTO>({
    id: '',
    customer_id: '',
    items: [],
    subtotal_cents: 0,
    total_cents: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(authService.getUser());

  // View state management
  const [viewState, setViewState] = useState<ViewState>('browse');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      const user = authService.getUser();
      setUser(user);
      // Load cart for authenticated user
      loadCart();
    }
  }, []);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(getApiUrl('/products/categories'));
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams({
          page: currentPage.toString(),
          limit: '20',
          ...(selectedCategory && { category: selectedCategory }),
          ...(searchTerm && { search: searchTerm }),
        });
        const response = await fetch(getApiUrl(`/products?${query}`));
        if (response.ok) {
          const data: ProductListResponse = await response.json();
          setProducts(data.data);
          setPagination({ total: data.total, pages: data.pages });
        } else {
          setError('Failed to load products');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [currentPage, selectedCategory, searchTerm]);

  /**
   * Load cart for authenticated user
   */
  const loadCart = async () => {
    try {
      const response = await fetch(getApiUrl('/carts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
      });

      if (response.ok) {
        const newCart: CartDTO = await response.json();
        setCart(newCart);
        localStorage.setItem('cartId', newCart.id);
      }
    } catch (err) {
      console.error('Failed to load cart', err);
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const addToCart = async (productId: string) => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      return;
    }

    if (!cart || !cart.id) {
      // Create/load cart first
      try {
        const cartResponse = await fetch(getApiUrl('/carts'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeader(),
          },
        });
        if (cartResponse.ok) {
          const newCart: CartDTO = await cartResponse.json();
          setCart(newCart);
          localStorage.setItem('cartId', newCart.id);
        } else {
          alert('Failed to create cart');
          return;
        }
      } catch (err) {
        console.error('Failed to create cart', err);
        alert('Failed to create cart');
        return;
      }
    }

    const cartId = cart.id || localStorage.getItem('cartId');
    if (!cartId) {
      alert('No cart available');
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/carts/${cartId}/items`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });
      if (response.ok) {
        const updatedCart: CartDTO = await response.json();
        setCart(updatedCart);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add to cart');
      }
    } catch (err) {
      console.error('Failed to add to cart', err);
      alert('Failed to add to cart');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setCart({
      id: '',
      customer_id: '',
      items: [],
      subtotal_cents: 0,
      total_cents: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    setCartOpen(false);
    localStorage.removeItem('cartId');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Show login if not authenticated */}
      {!isAuthenticated && <LoginPage onLoginSuccess={() => {
        setIsAuthenticated(true);
        setUser(authService.getUser());
        loadCart();
      }} />}

      {isAuthenticated && (
        <>
          <header className="bg-white shadow sticky top-0 z-10">
            <div className="mx-auto max-w-7xl px-4 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Razor Store</h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user?.name || user?.email}
                </span>
                <button
                  onClick={() => setCartOpen(!cartOpen)}
                  className="relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Cart
                  {cart && cart.items.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {cart.items.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Sidebar */}
              <aside className="lg:col-span-1">
                <div className="bg-white p-4 rounded shadow">
                  <h3 className="text-lg font-semibold mb-4">Filters</h3>
                  
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 block mb-2">Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      placeholder="Search products..."
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </aside>

              {/* Products */}
              <div className="lg:col-span-3">
                {loading && <p className="text-center py-8">Loading products...</p>}
                {error && <p className="text-center py-8 text-red-600">{error}</p>}
                {!loading && products.length === 0 && <p className="text-center py-8">No products found</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white p-4 rounded shadow hover:shadow-lg transition">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                      <p className="text-xs text-gray-500 mb-3">{product.category}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-blue-600">{formatPrice(product.price_cents)}</span>
                        <button
                          onClick={() => addToCart(product.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex justify-center gap-2 mb-8">
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Cart Drawer */}
          {cartOpen && (
            <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg p-4 overflow-y-auto z-40">
              <h2 className="text-xl font-bold mb-4">Shopping Cart</h2>
              {cart && cart.items.length > 0 ? (
                <>
                  {cart.items.map((item: CartItemDTO) => (
                    <div key={item.product_id} className="border-b py-2 mb-2">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      <p className="text-blue-600 font-semibold">{formatPrice(item.line_total_cents)}</p>
                    </div>
                  ))}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-lg font-bold mb-4">Total: {formatPrice(cart.total_cents)}</p>
                    <button
                      onClick={() => {
                        setCartOpen(false);
                        setViewState('checkout');
                      }}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mb-2"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-600">Your cart is empty</p>
              )}
              <button
                onClick={() => setCartOpen(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          )}

          {/* Checkout Modal */}
          {viewState === 'checkout' && cart && (
            <Checkout
              cart={cart}
              customerId={user?.id || ''}
              onOrderCreated={(id, amount) => {
                setOrderId(id);
                setOrderAmount(amount);
                setViewState('payment');
              }}
              onCancel={() => setViewState('browse')}
            />
          )}

          {/* Payment Modal */}
          {viewState === 'payment' && orderId && (
            <PaymentPage
              orderId={orderId}
              amountCents={orderAmount}
              onPaymentComplete={(status) => {
                if (status === 'success') {
                  setViewState('confirmation');
                  // Clear cart on successful payment
                  setCart({
                    id: '',
                    customer_id: '',
                    items: [],
                    subtotal_cents: 0,
                    total_cents: 0,
                    created_at: new Date(),
                    updated_at: new Date(),
                  });
                  setCartOpen(false);
                  localStorage.removeItem('cartId');
                } else {
                  setViewState('browse');
                  setOrderId(null);
                }
              }}
              onCancel={() => {
                setViewState('browse');
                setOrderId(null);
              }}
            />
          )}

          {/* Order Confirmation Modal */}
          {viewState === 'confirmation' && orderId && (
            <OrderConfirmation
              orderId={orderId}
              onDone={() => {
                setViewState('browse');
                setOrderId(null);
                setOrderAmount(0);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
