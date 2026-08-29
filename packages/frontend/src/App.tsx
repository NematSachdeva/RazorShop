import { useEffect, useState } from 'react';
import { getApiUrl } from './config/api';
import { ProductDTO, CartDTO, ProductListResponse } from '@razor/shared';
import Checkout from './components/Checkout';
import PaymentPage from './components/PaymentPage';
import OrderConfirmation from './components/OrderConfirmation';
import LoginPage from './components/LoginPage';
import MerchantDashboard from './components/MerchantDashboard';
import CustomerOrders from './components/CustomerOrders';
import ProductDetailModal from './components/ProductDetailModal';
import CartDrawer from './components/CartDrawer';
import StockBadge from './components/common/StockBadge';
import ProfilePopover from './components/common/ProfilePopover';
import { authService } from './services/authService';

type ViewState = 'browse' | 'checkout' | 'payment' | 'confirmation';
type ActiveTab = 'store' | 'orders';

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

  // Selected product modal for recommendations
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(authService.getUser());

  // Customer Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');

  // View state management
  const [viewState, setViewState] = useState<ViewState>('browse');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);

  // Check authentication & recovery deep-links on mount
  useEffect(() => {
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      const currentUser = authService.getUser();
      setUser(currentUser);
      if (currentUser?.role === 'customer') {
        loadCart();
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') || params.get('order')) {
      setActiveTab('orders');
      setViewState('browse');
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
          limit: '100',
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

  const handleUnauthorized = () => {
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
  };

  /**
   * Load active cart for authenticated user
   */
  const loadCart = async () => {
    const currentUser = authService.getUser();
    if (!currentUser || currentUser.role !== 'customer') {
      return;
    }
    try {
      const response = await fetch(getApiUrl('/carts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

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

    let activeCartId = cart.id;

    if (!activeCartId) {
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
          activeCartId = newCart.id;
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

    try {
      const response = await fetch(getApiUrl(`/carts/${activeCartId}/items`), {
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

  const addBundleToCart = async (recommendationId: string) => {
    if (!isAuthenticated) {
      alert('Please login to add bundle to cart');
      return;
    }

    let activeCartId = cart.id;
    if (!activeCartId) {
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
          activeCartId = newCart.id;
          localStorage.setItem('cartId', newCart.id);
        } else {
          alert('Failed to create cart');
          return;
        }
      } catch (err) {
        console.error('Failed to create cart', err);
        return;
      }
    }

    try {
      const response = await fetch(getApiUrl(`/carts/${activeCartId}/bundle`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ recommendation_id: recommendationId }),
      });
      if (response.ok) {
        const updatedCart: CartDTO = await response.json();
        setCart(updatedCart);
        setCartOpen(true);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add bundle to cart');
      }
    } catch (err) {
      console.error('Failed to add bundle to cart', err);
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!cart.id) return;
    try {
      const response = await fetch(getApiUrl(`/carts/${cart.id}/items/${productId}`), {
        method: 'DELETE',
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (response.ok) {
        const updatedCart: CartDTO = await response.json();
        setCart(updatedCart);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove item from cart');
      }
    } catch (err) {
      console.error('Failed to remove item from cart', err);
      alert('Failed to remove item from cart');
    }
  };

  const updateCartQuantity = async (productId: string, newQuantity: number) => {
    if (!cart.id) return;
    try {
      const response = await fetch(getApiUrl(`/carts/${cart.id}/items/${productId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (response.ok) {
        const updatedCart: CartDTO = await response.json();
        setCart(updatedCart);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update quantity');
      }
    } catch (err: any) {
      console.error('Failed to update item quantity', err);
      alert(err.message || 'Failed to update item quantity');
      throw err;
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
    setActiveTab('store');
    localStorage.removeItem('cartId');
  };

  const handleStartPayment = (id: string, amount: number) => {
    setOrderId(id);
    setOrderAmount(amount);
    setViewState('payment');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Show login if not authenticated */}
      {!isAuthenticated && (
        <LoginPage
          onLoginSuccess={() => {
            const currentUser = authService.getUser();
            setIsAuthenticated(true);
            setUser(currentUser);
            if (currentUser?.role === 'customer') {
              loadCart();
            }
          }}
        />
      )}

      {isAuthenticated && user && (
        <>
          {/* Merchant Navigation Header & Dashboard */}
          {user.role === 'merchant' && (
            <div>
              <header className="bg-purple-950 text-white shadow-md sticky top-0 z-30 border-b border-purple-800">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏬</span>
                    <div>
                      <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                        RAZOR <span className="bg-purple-800 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Merchant Hub</span>
                      </h1>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ProfilePopover
                      user={user}
                      onLogout={handleLogout}
                      onNavigateToMerchant={() => setActiveTab('store')}
                    />
                  </div>
                </div>
              </header>
              <MerchantDashboard />
            </div>
          )}

          {/* Customer Store */}
          {user.role === 'customer' && (
            <>
              <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-30 border-b border-gray-200">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div
                      onClick={() => setActiveTab('store')}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md group-hover:bg-blue-700 transition">
                        ⚡
                      </div>
                      <span className="text-xl font-black tracking-tight text-gray-900">
                        RAZOR <span className="text-blue-600">STORE</span>
                      </span>
                    </div>

                    <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                      <button
                        onClick={() => setActiveTab('store')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'store'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Store
                      </button>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'orders'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Orders
                      </button>
                    </nav>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCartOpen(true)}
                      className="relative px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
                    >
                      <span>🛒</span>
                      <span className="hidden sm:inline">Cart</span>
                      {cart && cart.items && cart.items.length > 0 && (
                        <span className="bg-red-500 text-white text-[11px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center animate-pulse">
                          {cart.items.length}
                        </span>
                      )}
                    </button>

                    <ProfilePopover
                      user={user}
                      onLogout={handleLogout}
                      onNavigateToOrders={() => setActiveTab('orders')}
                      onNavigateToStore={() => setActiveTab('store')}
                      onOpenCart={() => setCartOpen(true)}
                    />
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 min-h-[calc(100vh-80px)]">
                {activeTab === 'orders' ? (
                  <CustomerOrders
                    onContinuePayment={(id, amount) => handleStartPayment(id, amount)}
                    onRetryPayment={(id, amount) => handleStartPayment(id, amount)}
                    targetOrderId={new URLSearchParams(window.location.search).get('payment') || new URLSearchParams(window.location.search).get('order')}
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Filters */}
                    <aside className="lg:col-span-1">
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5 sticky top-24">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                          <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                            <span>🔍</span>
                            <span>Filters & Search</span>
                          </h3>
                          {(searchTerm || selectedCategory) && (
                            <button
                              onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('');
                                setCurrentPage(1);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {/* Search Bar */}
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wider">
                            Search Products
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                              }}
                              placeholder="Search by title..."
                              className="w-full pl-3.5 pr-8 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            />
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Category Dropdown */}
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wider">
                            Category
                          </label>
                          <select
                            value={selectedCategory}
                            onChange={(e) => {
                              setSelectedCategory(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 font-medium"
                          >
                            <option value="">All Categories ({categories.length})</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status Count Summary */}
                        <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 font-medium flex justify-between items-center">
                          <span>Results found:</span>
                          <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {pagination.total} {pagination.total === 1 ? 'product' : 'products'}
                          </span>
                        </div>
                      </div>
                    </aside>

                    {/* Products Grid */}
                    <div className="lg:col-span-3">
                      {loading && <p className="text-center py-8">Loading products...</p>}
                      {error && <p className="text-center py-8 text-red-600">{error}</p>}
                      {!loading && products.length === 0 && <p className="text-center py-8">No products found</p>}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {products.map((product) => {
                          const available = product.inventory?.available ?? 10;
                          const canAdd = available > 0;

                          return (
                            <div
                              key={product.id}
                              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <h3
                                    onClick={() => setSelectedProduct(product)}
                                    className="font-bold text-gray-900 text-base line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                                  >
                                    {product.name}
                                  </h3>
                                  <span className="bg-gray-100 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded shrink-0">
                                    {product.category || 'General'}
                                  </span>
                                </div>

                                <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                  {product.description}
                                </p>

                                <div className="mb-3">
                                  <StockBadge availableQuantity={available} compact />
                                </div>
                              </div>

                              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                                <span className="text-xl font-extrabold text-blue-700">
                                  {formatPrice(product.price_cents)}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedProduct(product)}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
                                  >
                                    Details
                                  </button>
                                  <button
                                    disabled={!canAdd}
                                    onClick={() => addToCart(product.id)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition ${
                                      canAdd
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed border'
                                    }`}
                                  >
                                    {canAdd ? 'Add to Cart' : 'Out of Stock'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {pagination.pages > 1 && (
                        <div className="flex justify-center gap-2 mb-8">
                          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3.5 py-2 rounded-lg font-bold text-sm transition ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </main>

              {/* Product Detail & Recommendation Modal */}
              {selectedProduct && (
                <ProductDetailModal
                  product={selectedProduct}
                  onClose={() => setSelectedProduct(null)}
                  onAddToCart={(pId) => {
                    addToCart(pId);
                    setSelectedProduct(null);
                  }}
                  onAddBundleToCart={(recId) => {
                    addBundleToCart(recId);
                    setSelectedProduct(null);
                  }}
                />
              )}

              {/* Cart Drawer Component */}
              <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                cart={cart}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
                onRemoveItem={removeFromCart}
                onAddBundleToCart={addBundleToCart}
                onCheckout={() => {
                  setCartOpen(false);
                  setViewState('checkout');
                }}
              />

              {/* Checkout Modal */}
              {viewState === 'checkout' && cart && (
                <Checkout
                  cart={cart}
                  customerId={user?.id || ''}
                  onOrderCreated={(id, amount) => {
                    setOrderId(id);
                    setOrderAmount(amount);
                    setViewState('payment');
                    // Reload cart so customer gets a new active cart
                    loadCart();
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
                      loadCart();
                    } else {
                      // Navigate to Orders page on cancel or failure so user can Continue / Retry
                      setActiveTab('orders');
                      setViewState('browse');
                      setOrderId(null);
                    }
                  }}
                  onCancel={() => {
                    // Navigate to Orders tab so user can access order anytime
                    setActiveTab('orders');
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
                    setActiveTab('orders');
                    setViewState('browse');
                    setOrderId(null);
                    setOrderAmount(0);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
