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
import { AddressesModal } from './components/common/AddressesModal';
import ApplicationStatusPage from './components/ApplicationStatusPage';
import AdminDashboard from './components/AdminDashboard';
import Footer from './components/Footer';
import { PrivacyPolicyPage } from './components/info/PrivacyPolicyPage';
import { TermsOfServicePage } from './components/info/TermsOfServicePage';
import { ContactSupportPage } from './components/info/ContactSupportPage';
import { ApiStatusPage } from './components/info/ApiStatusPage';
import {
  IconSearch,
  IconCart,
  IconFilter,
  IconClose,
  IconStore,
  IconPackage,
} from './components/common/Icons';
import { authService } from './services/authService';

type ViewState = 'browse' | 'checkout' | 'payment' | 'confirmation';
type ActiveTab = 'store' | 'orders' | 'privacy' | 'terms' | 'support' | 'status';

export default function App() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddressesModalOpen, setIsAddressesModalOpen] = useState(false);
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
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc'>('newest');
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  // Selected product modal for recommendations & detail view
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(authService.getUser());

  // Customer Navigation State (HTML5 History router integration)
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');

  // View state management
  const [viewState, setViewState] = useState<ViewState>('browse');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);

  // Merchant Application View state
  const [showApplicationStatusView, setShowApplicationStatusView] = useState(false);

  const getTabFromPath = (path: string): ActiveTab => {
    const p = path.toLowerCase();
    if (p === '/orders') return 'orders';
    if (p === '/privacy') return 'privacy';
    if (p === '/terms') return 'terms';
    if (p === '/support' || p === '/contact') return 'support';
    if (p === '/status' || p === '/health') return 'status';
    return 'store';
  };

  const navigateToPath = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setActiveTab(getTabFromPath(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen for browser Back & Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    setActiveTab(getTabFromPath(window.location.pathname));

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
      navigateToPath('/orders');
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

  // Fetch products with search, category, minPrice, maxPrice, sort
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
          ...(minPrice !== '' && !isNaN(Number(minPrice)) && { minPrice }),
          ...(maxPrice !== '' && !isNaN(Number(maxPrice)) && { maxPrice }),
          ...(sortOption && { sort: sortOption }),
        });
        const response = await fetch(getApiUrl(`/products?${query}`));
        if (response.ok) {
          const data: ProductListResponse = await response.json();
          setProducts(data.data || []);
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
  }, [currentPage, selectedCategory, searchTerm, minPrice, maxPrice, sortOption]);

  const handleUnauthorized = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setShowApplicationStatusView(false);
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
    setShowApplicationStatusView(false);
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
    navigateToPath('/');
    localStorage.removeItem('cartId');
  };

  const handleStartPayment = (id: string, amount: number) => {
    setOrderId(id);
    setOrderAmount(amount);
    setViewState('payment');
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSearchTerm('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSortOption('newest');
    setCurrentPage(1);
  };

  const filteredProducts = inStockOnly
    ? products.filter((p) => (p.inventory?.available ?? 0) > 0)
    : products;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
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
          {activeTab === 'privacy' || activeTab === 'terms' || activeTab === 'support' || activeTab === 'status' ? (
            <div className="min-h-screen flex flex-col w-full bg-gray-50 font-sans text-gray-900">
              {/* Universal Info Header */}
              <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => navigateToPath('/')}
                      className="cursor-pointer group flex items-center gap-2 select-none"
                      title="RazorShop Home"
                    >
                      <span className="text-2xl font-black tracking-tight text-gray-900">
                        Razor<span className="text-blue-600">Shop</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
                      {user.role === 'merchant'
                        ? 'Merchant Documentation'
                        : user.role === 'admin'
                        ? 'Admin Documentation'
                        : 'Documentation'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateToPath('/')}
                      className="px-3.5 py-2 text-xs font-bold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition shadow-xs"
                    >
                      Back to {user.role === 'merchant' ? 'Merchant Dashboard' : user.role === 'admin' ? 'Admin Portal' : 'Store Catalog'}
                    </button>
                    <ProfilePopover user={user} onLogout={handleLogout} />
                  </div>
                </div>
              </header>

              {/* Info Content Workspace */}
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {activeTab === 'privacy' && <PrivacyPolicyPage />}
                {activeTab === 'terms' && <TermsOfServicePage />}
                {activeTab === 'support' && <ContactSupportPage />}
                {activeTab === 'status' && <ApiStatusPage />}
              </main>

              {/* Universal Footer */}
              <Footer
                isMerchant={user.role === 'merchant'}
                isAdmin={user.role === 'admin'}
                onNavigateToStore={() => navigateToPath('/')}
                onNavigateToOrders={() => navigateToPath('/orders')}
                onOpenCart={() => navigateToPath('/')}
                onOpenPrivacy={() => navigateToPath('/privacy')}
                onOpenTerms={() => navigateToPath('/terms')}
                onOpenContact={() => navigateToPath('/support')}
                onOpenApiStatus={() => navigateToPath('/status')}
              />
            </div>
          ) : (
            <>
              {/* Admin Dashboard */}
              {user.role === 'admin' && (
                <AdminDashboard onLogout={handleLogout} onNavigateToPath={navigateToPath} />
              )}

              {/* Merchant Views */}
              {user.role === 'merchant' && (
                <>
                  {showApplicationStatusView || user.application_status === 'pending' || user.application_status === 'rejected' ? (
                    <ApplicationStatusPage
                      onGoToDashboard={() => setShowApplicationStatusView(false)}
                      onLogout={handleLogout}
                    />
                  ) : (
                    <MerchantDashboard
                      onShowApplicationTimeline={() => setShowApplicationStatusView(true)}
                      onLogout={handleLogout}
                      onNavigateToPath={navigateToPath}
                    />
                  )}
                </>
              )}

              {/* Customer Storefront */}
              {user.role === 'customer' && (
            <div className="min-h-screen flex flex-col w-full">
              {/* Full-width Header */}
              <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex justify-between items-center gap-4">
                  {/* Brand & Main Navigation */}
                  <div className="flex items-center gap-8">
                    {/* Clickable Brand Logo -> Returns to Store Catalog */}
                    <div
                      onClick={() => navigateToPath('/')}
                      className="cursor-pointer group flex items-center gap-2 select-none"
                      title="RazorShop Home / Catalog"
                      id="brand-logo"
                    >
                      <span className="text-2xl font-black tracking-tight text-gray-900">
                        Razor<span className="text-blue-600">Shop</span>
                      </span>
                    </div>

                    <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                      <button
                        onClick={() => navigateToPath('/')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          activeTab === 'store'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <IconStore className="w-3.5 h-3.5" />
                        <span>Store</span>
                      </button>
                      <button
                        onClick={() => navigateToPath('/orders')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          activeTab === 'orders'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <IconPackage className="w-3.5 h-3.5" />
                        <span>Orders</span>
                      </button>
                    </nav>
                  </div>

                  {/* Actions (Cart & Profile) */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCartOpen(true)}
                      className="relative px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 active:scale-95"
                    >
                      <IconCart className="w-4 h-4 text-white" />
                      <span className="hidden sm:inline">Cart</span>
                      {cart && cart.items && cart.items.length > 0 && (
                        <span className="bg-red-500 text-white text-[11px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center">
                          {cart.items.length}
                        </span>
                      )}
                    </button>

                    <ProfilePopover
                      user={user}
                      onLogout={handleLogout}
                      onNavigateToOrders={() => navigateToPath('/orders')}
                      onNavigateToAddresses={() => setIsAddressesModalOpen(true)}
                      onNavigateToStore={() => navigateToPath('/')}
                      onOpenCart={() => setCartOpen(true)}
                    />
                  </div>
                </div>
              </header>

              {/* Main Container */}
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {activeTab === 'orders' && (
                  <CustomerOrders
                    onContinuePayment={(id, amount) => handleStartPayment(id, amount)}
                    onRetryPayment={(id, amount) => handleStartPayment(id, amount)}
                    targetOrderId={new URLSearchParams(window.location.search).get('payment') || new URLSearchParams(window.location.search).get('order')}
                  />
                )}

                {activeTab === 'store' && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Sidebar Filters */}
                    <aside className="lg:col-span-1">
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-6 sticky top-24">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <IconFilter className="w-4 h-4 text-blue-600" />
                            <span>Filters</span>
                          </h3>
                          {(selectedCategory || searchTerm || minPrice || maxPrice || inStockOnly) && (
                            <button
                              onClick={clearAllFilters}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {/* Category List */}
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wider">
                            Categories
                          </label>
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            <button
                              onClick={() => {
                                setSelectedCategory('');
                                setCurrentPage(1);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                selectedCategory === ''
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              All Categories
                            </button>
                            {categories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setCurrentPage(1);
                                }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                  selectedCategory === cat
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Price Range Filter */}
                        <div className="pt-4 border-t border-gray-100 space-y-2">
                          <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                            Price Range (₹)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                type="number"
                                value={minPrice}
                                onChange={(e) => {
                                  setMinPrice(e.target.value);
                                  setCurrentPage(1);
                                }}
                                placeholder="₹ Min"
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                value={maxPrice}
                                onChange={(e) => {
                                  setMaxPrice(e.target.value);
                                  setCurrentPage(1);
                                }}
                                placeholder="₹ Max"
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                              />
                            </div>
                          </div>
                        </div>

                        {/* In Stock Toggle */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                          <label htmlFor="inStockFilter" className="text-xs font-bold text-gray-700 cursor-pointer">
                            In Stock Only
                          </label>
                          <input
                            type="checkbox"
                            id="inStockFilter"
                            checked={inStockOnly}
                            onChange={(e) => {
                              setInStockOnly(e.target.checked);
                              setCurrentPage(1);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* Result Count */}
                        <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 font-medium flex justify-between items-center">
                          <span>Products found:</span>
                          <span className="font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-full">
                            {filteredProducts.length}
                          </span>
                        </div>
                      </div>
                    </aside>

                    {/* Right Product Catalog */}
                    <div className="lg:col-span-3 space-y-6">
                      {/* Top Bar (Heading + Search + Sort) */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                        <div>
                          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                            RazorShop Store
                          </span>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1 font-heading tracking-tight">
                            {selectedCategory || 'Collection Catalog'}
                          </h1>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                          {/* Search Input */}
                          <div className="relative w-full sm:w-72">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                              }}
                              placeholder="Search products..."
                              className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 font-medium"
                            />
                            <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                              >
                                <IconClose className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Sort Dropdown */}
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Sort by:</span>
                            <select
                              value={sortOption}
                              onChange={(e) => {
                                setSortOption(e.target.value as any);
                                setCurrentPage(1);
                              }}
                              className="w-full sm:w-auto px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 font-bold text-gray-800"
                            >
                              <option value="newest">Recommended / Newest</option>
                              <option value="price_asc">Price: Low to High</option>
                              <option value="price_desc">Price: High to Low</option>
                              <option value="name_asc">Name: A to Z</option>
                              <option value="name_desc">Name: Z to A</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Product Grid */}
                      {loading && (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                          <p className="text-gray-500 text-sm font-medium">Loading catalog products...</p>
                        </div>
                      )}
                      {error && (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-red-600">
                          <p className="font-bold">{error}</p>
                        </div>
                      )}
                      {!loading && filteredProducts.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 space-y-2">
                          <p className="text-gray-800 font-bold text-base">No products match your criteria</p>
                          <p className="text-gray-500 text-xs">Try clearing or broadening your search and filter settings.</p>
                          <button
                            onClick={clearAllFilters}
                            className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
                          >
                            Clear Filters
                          </button>
                        </div>
                      )}

                      {!loading && filteredProducts.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredProducts.map((product) => {
                            const available = product.inventory?.available ?? 10;
                            const canAdd = available > 0;

                            return (
                              <div
                                key={product.id}
                                onClick={() => setSelectedProduct(product)}
                                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:border-gray-300"
                              >
                                <div>
                                  <div className="mb-2">
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                                      {product.category || 'General'}
                                    </span>
                                  </div>

                                  <h3 className="font-semibold font-heading text-gray-900 text-base mb-1.5 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {product.name}
                                  </h3>

                                  <p className="text-xs text-gray-600 mb-4 line-clamp-3 leading-relaxed font-normal">
                                    {product.description || 'High quality product carefully inspected for maximum value.'}
                                  </p>
                                </div>

                                <div className="space-y-3 pt-3 border-t border-gray-100">
                                  <div>
                                    <StockBadge availableQuantity={available} compact />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-xl font-bold font-price text-gray-900">
                                      {formatPrice(product.price_cents)}
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProduct(product);
                                        }}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition"
                                      >
                                        Details
                                      </button>
                                      <button
                                        disabled={!canAdd}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (canAdd) addToCart(product.id);
                                        }}
                                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition shadow-xs ${
                                          canAdd
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border'
                                        }`}
                                      >
                                        {canAdd ? 'Add' : 'Out of Stock'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Pagination */}
                      {pagination.pages > 1 && (
                        <div className="flex justify-center gap-2 pt-4">
                          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3.5 py-2 rounded-xl font-bold text-xs transition ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                  onSelectProduct={(p) => setSelectedProduct(p)}
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
                onSelectProduct={(p) => setSelectedProduct(p)}
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
                      navigateToPath('/orders');
                      setViewState('browse');
                      setOrderId(null);
                    }
                  }}
                  onCancel={() => {
                    navigateToPath('/orders');
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
                    navigateToPath('/orders');
                    setViewState('browse');
                    setOrderId(null);
                    setOrderAmount(0);
                  }}
                />
              )}

              {/* Customer Saved Addresses Modal */}
              <AddressesModal
                isOpen={isAddressesModalOpen}
                onClose={() => setIsAddressesModalOpen(false)}
              />

              {/* Footer */}
              <Footer
                onNavigateToStore={() => navigateToPath('/')}
                onNavigateToOrders={() => navigateToPath('/orders')}
                onOpenCart={() => setCartOpen(true)}
                onOpenPrivacy={() => navigateToPath('/privacy')}
                onOpenTerms={() => navigateToPath('/terms')}
                onOpenContact={() => navigateToPath('/support')}
                onOpenApiStatus={() => navigateToPath('/status')}
              />
            </div>
          )}
        </>
      )}
    </>
  )}
</div>
  );
}
