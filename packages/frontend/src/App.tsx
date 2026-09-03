import { useEffect, useState, useCallback, useRef } from 'react';
import { getApiUrl, getImageUrl } from './config/api';
import { ProductDTO, CartDTO, ProductListResponse } from '@razor/shared';
import Checkout from './components/Checkout';
import PaymentPage from './components/PaymentPage';
import OrderConfirmation from './components/OrderConfirmation';
import SignInModal, { AuthTab } from './components/SignInModal';
import MerchantDashboard from './components/MerchantDashboard';
import CustomerOrders from './components/CustomerOrders';
import ProductDetailModal from './components/ProductDetailModal';
import CartDrawer from './components/CartDrawer';

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

  // Global Light / Dark Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(authService.getUser());

  // Sign In Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthTab>('customer');
  const [pendingAddToCartProductId, setPendingAddToCartProductId] = useState<string | null>(null);

  const openAuthModal = (tab: AuthTab = 'customer') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

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
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/products/categories'));
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch products with search, category, minPrice, maxPrice, sort
  const fetchProducts = useCallback(async () => {
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
        setError('Unable to load products. Server returned an error.');
      }
    } catch (err) {
      setError('Unable to load products. Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory, searchTerm, minPrice, maxPrice, sortOption]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRetry = () => {
    fetchCategories();
    fetchProducts();
  };

  const handleSelectProduct = async (product: ProductDTO) => {
    setSelectedProduct(product);
    try {
      const response = await fetch(getApiUrl(`/products/${product.id}`));
      if (response.ok) {
        const freshProduct: ProductDTO = await response.json();
        setSelectedProduct(freshProduct);
      }
    } catch {
      // Fall back to original product object
    }
  };

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

  const executeAddToCart = async (productId: string) => {
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

  const addToCart = async (productId: string) => {
    if (!isAuthenticated) {
      setPendingAddToCartProductId(productId);
      openAuthModal('customer');
      return;
    }
    await executeAddToCart(productId);
  };

  const addBundleToCart = async (recommendationId: string) => {
    if (!isAuthenticated) {
      openAuthModal('customer');
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

  const handleLoginSuccess = async (loggedInUser: any) => {
    setIsAuthenticated(true);
    setUser(loggedInUser);
    if (loggedInUser?.role === 'customer') {
      await loadCart();
      if (pendingAddToCartProductId) {
        const pId = pendingAddToCartProductId;
        setPendingAddToCartProductId(null);
        await executeAddToCart(pId);
      }
    }
  };

  const handleForSellersClick = () => {
    if (isAuthenticated && user?.role === 'merchant') {
      navigateToPath('/');
    } else {
      openAuthModal('seller');
    }
  };

  const handleAdminLoginClick = () => {
    if (isAuthenticated && user?.role === 'admin') {
      navigateToPath('/');
    } else {
      openAuthModal('admin');
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

  // Scroll-reveal observer for product cards — re-runs whenever products change
  const shopRef = useRef<HTMLDivElement>(null);
  const [heroScrolled, setHeroScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let intersectionObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let animationFrameId: number;

    const setupObserver = () => {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in-view');
            }
          });
        },
        { threshold: 0.01, rootMargin: '50px 0px 50px 0px' }
      );

      const elements = document.querySelectorAll('.reveal');
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 150 && rect.bottom > -150) {
          el.classList.add('in-view');
        }
        intersectionObserver?.observe(el);
      });
    };

    animationFrameId = requestAnimationFrame(() => {
      setupObserver();
    });

    mutationObserver = new MutationObserver(() => {
      setupObserver();
    });

    const targetNode = shopRef.current || document.body;
    mutationObserver.observe(targetNode, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
    };
  }, [filteredProducts, selectedCategory, activeTab, currentPage, sortOption, minPrice, maxPrice, searchTerm, products, loading]);

  // Detect scroll past hero for sticky header & smooth scroll-linked hero animation
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setHeroScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {/* Universal Info Pages View */}
      {activeTab === 'privacy' || activeTab === 'terms' || activeTab === 'support' || activeTab === 'status' ? (
        <div className="min-h-screen flex flex-col w-full font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
          {/* Universal Info Header */}
          <header className="w-full sticky top-0 z-30 themed" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
            <div className="w-full px-6 py-3.5 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  onClick={() => navigateToPath('/')}
                  className="cursor-pointer group flex items-center gap-2 select-none"
                  title="RazorShop Home"
                >
                  <span className="font-display text-2xl font-black tracking-tight" style={{ color: 'var(--c-text)' }}>
                    Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)', background: 'var(--c-gold-dim)' }}>
                  {user?.role === 'merchant'
                    ? 'Merchant Documentation'
                    : user?.role === 'admin'
                    ? 'Admin Documentation'
                    : 'Documentation'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-sm"
                  style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button
                  onClick={() => navigateToPath('/')}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl transition shadow-xs font-display cursor-pointer"
                  style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
                >
                  ← Back to {user?.role === 'merchant' ? 'Merchant Dashboard' : user?.role === 'admin' ? 'Admin Portal' : 'Store'}
                </button>
                {user ? (
                  <ProfilePopover user={user} onLogout={handleLogout} />
                ) : (
                  <button
                    onClick={() => openAuthModal('customer')}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl transition shadow-xs font-display cursor-pointer"
                    style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
                  >
                    Sign In
                  </button>
                )}
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
            isMerchant={user?.role === 'merchant'}
            isAdmin={user?.role === 'admin'}
            onNavigateToStore={() => navigateToPath('/')}
            onNavigateToOrders={() => navigateToPath('/orders')}
            onOpenCart={() => navigateToPath('/')}
            onOpenPrivacy={() => navigateToPath('/privacy')}
            onOpenTerms={() => navigateToPath('/terms')}
            onOpenContact={() => navigateToPath('/support')}
            onOpenApiStatus={() => navigateToPath('/status')}
            onOpenForSellers={handleForSellersClick}
            onOpenAdminLogin={handleAdminLoginClick}
          />
        </div>
      ) : isAuthenticated && user?.role === 'admin' ? (
        /* Admin Dashboard */
        <AdminDashboard onLogout={handleLogout} onNavigateToPath={navigateToPath} />
      ) : isAuthenticated && user?.role === 'merchant' ? (
        /* Seller / Merchant Views */
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
      ) : (
        /* Customer Storefront (Default view for Guests & Customers) */
        <div className="min-h-screen flex flex-col w-full" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>

          {/* ── Sticky Header — fades in once user scrolls past hero ─── */}
          {(() => {
            const isTransparentHero = activeTab === 'store' && !heroScrolled;
            return (
              <header
                className="w-full fixed top-0 left-0 right-0 z-40 themed transition-all duration-300"
                style={{
                  background: isTransparentHero ? 'transparent' : 'var(--c-surface)',
                  borderBottom: isTransparentHero ? '1px solid transparent' : '1px solid var(--c-border)',
                  backdropFilter: isTransparentHero ? 'none' : 'blur(12px)',
                }}
              >
                <div className="w-full px-6 py-4 flex justify-between items-center gap-4">
                  {/* Brand */}
                  <div
                    onClick={() => navigateToPath('/')}
                    className="cursor-pointer select-none"
                    title="RazorShop Home / Catalog"
                    id="brand-logo"
                  >
                    <span
                      className="font-display text-xl font-black tracking-tight transition-colors"
                      style={{ color: isTransparentHero ? 'var(--c-hero-text)' : 'var(--c-text)' }}
                    >
                      Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
                    </span>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleTheme}
                      className="p-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-sm"
                      style={{
                        background: isTransparentHero ? 'rgba(255,255,255,0.12)' : 'var(--c-surface2)',
                        borderColor: isTransparentHero ? 'rgba(255,255,255,0.2)' : 'var(--c-border)',
                        color: 'var(--c-gold)',
                      }}
                      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                    >
                      {theme === 'dark' ? '☀️' : '🌙'}
                    </button>

                    <button
                      onClick={handleForSellersClick}
                      className="hidden sm:block text-xs font-bold tracking-widest uppercase transition cursor-pointer font-display"
                      style={{ color: isTransparentHero ? 'var(--c-hero-text)' : 'var(--c-gold)', background: 'none', border: 'none' }}
                    >
                      For Sellers
                    </button>

                    <button
                      onClick={() => setCartOpen(true)}
                      className="relative px-4 py-2 text-xs font-bold rounded-none transition-all flex items-center gap-2 active:scale-95 cursor-pointer font-display"
                      style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
                    >
                      <IconCart className="w-4 h-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cart && cart.items && cart.items.length > 0 && (
                        <span className="bg-red-500 text-white text-[11px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          {cart.items.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                      )}
                    </button>

                    {isAuthenticated && user ? (
                      <ProfilePopover
                        user={user}
                        onLogout={handleLogout}
                        onNavigateToOrders={() => navigateToPath('/orders')}
                        onNavigateToAddresses={() => setIsAddressesModalOpen(true)}
                        onNavigateToStore={() => navigateToPath('/')}
                        onOpenCart={() => setCartOpen(true)}
                      />
                    ) : (
                      <button
                        onClick={() => openAuthModal('customer')}
                        className="px-4 py-2 text-xs font-extrabold transition cursor-pointer font-display"
                        style={{
                          background: isTransparentHero ? 'rgba(255,255,255,0.15)' : 'var(--c-cta-bg)',
                          color: isTransparentHero ? 'var(--c-hero-text)' : 'var(--c-cta-text)',
                          border: isTransparentHero ? '1px solid rgba(255,255,255,0.3)' : 'none',
                        }}
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </header>
            );
          })()}

          {/* Main Container */}
          <main className="flex-1 w-full">
            {activeTab === 'orders' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pt-24">
                <CustomerOrders
                  onContinuePayment={(id, amount) => handleStartPayment(id, amount)}
                  onRetryPayment={(id, amount) => handleStartPayment(id, amount)}
                  targetOrderId={new URLSearchParams(window.location.search).get('payment') || new URLSearchParams(window.location.search).get('order')}
                />
              </div>
            )}

            {activeTab === 'store' && (
              <div>
                {/* ── Full-viewport Hero Section ────────────────────────── */}
                <section
                  style={{
                    position: 'relative',
                    height: '100vh',
                    minHeight: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Fixed photographic background with parallax scroll effect */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
                      transform: `translateY(${scrollY * 0.25}px) scale(${1 + Math.min(0.08, scrollY / 3000)})`,
                      willChange: 'transform',
                    }}
                  >
                    <img
                      src="https://images.unsplash.com/photo-1519222970733-f546218fa6d7?w=1920&h=1080&fit=crop&auto=format&q=80"
                      alt="marketplace background"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, var(--c-hero-overlay-from) 0%, var(--c-hero-overlay-via) 45%, var(--c-hero-overlay-to) 100%)',
                      }}
                    />
                  </div>

                  {/* Hero copy — vertically centered with smooth scroll-linked transition */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '0 2.5rem 0 4rem',
                      maxWidth: '68rem',
                      transform: `translateY(${-scrollY * 0.35}px)`,
                      opacity: Math.max(0, 1 - scrollY / 550),
                      willChange: 'transform, opacity',
                    }}
                  >
                    <p
                      className="animate-fadeUp font-display"
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        letterSpacing: '0.28em',
                        textTransform: 'uppercase',
                        color: 'var(--c-hero-muted)',
                        animationDelay: '0.1s',
                        opacity: 0,
                        marginBottom: '1.25rem',
                      }}
                    >
                      India&apos;s Curated Marketplace
                    </p>
                    <h1
                      className="font-display font-bold animate-fadeUp"
                      style={{
                        fontSize: 'clamp(3.5rem, 11vw, 9rem)',
                        lineHeight: 1,
                        color: 'var(--c-hero-text)',
                        animationDelay: '0.2s',
                        opacity: 0,
                      }}
                    >
                      Everything<br />
                      <span style={{ color: 'var(--c-gold)' }}>you need.</span>
                    </h1>
                    <div
                      className="animate-fadeUp"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1.5rem',
                        marginTop: '2.5rem',
                        alignItems: 'center',
                        animationDelay: '0.35s',
                        opacity: 0,
                      }}
                    >
                      <button
                        onClick={() => shopRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="font-display font-semibold transition-all cursor-pointer"
                        style={{
                          fontSize: '0.875rem',
                          letterSpacing: '0.05em',
                          padding: '1rem 2rem',
                          background: 'var(--c-cta-bg)',
                          color: 'var(--c-cta-text)',
                          border: 'none',
                        }}
                      >
                        Browse Products
                      </button>
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                        {['/ Curated quality', '/ Free shipping', '/ Secure checkout'].map((t) => (
                          <span key={t} style={{ fontSize: '0.75rem', color: 'var(--c-hero-sub)' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Scroll cue — fades out quickly on scroll */}
                  <div
                    className="animate-scrollBounce"
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingBottom: '2.5rem',
                      gap: '0.5rem',
                      opacity: Math.max(0, 1 - scrollY / 200),
                      willChange: 'opacity',
                    }}
                  >
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--c-hero-muted)' }}>SCROLL</p>
                    <div style={{ width: '1px', height: '2rem', background: 'var(--c-gold)', opacity: 0.5 }} />
                  </div>
                </section>

                {/* ── Shop Section — slides up seamlessly over hero ──────── */}
                <section
                  ref={shopRef}
                  id="marketplace-catalog"
                  style={{ position: 'relative', zIndex: 2, background: 'var(--c-bg)', minHeight: '100vh' }}
                >
                  {/* Seamless gradient bleed — hero photo fades into bg */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-100px',
                      left: 0,
                      right: 0,
                      height: '100px',
                      background: 'linear-gradient(to bottom, transparent 0%, var(--c-bg) 100%)',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />

                  <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '4rem 2.5rem 5rem', position: 'relative', zIndex: 1 }}>

                    {/* Marketplace Header */}
                    <div
                      className="reveal"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--c-border)',
                        paddingBottom: '1.75rem',
                        marginBottom: '2rem',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <p
                          className="font-display"
                          style={{ fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--c-gold)', marginBottom: '0.5rem' }}
                        >
                          MARKETPLACE
                        </p>
                        <h2
                          className="font-display"
                          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}
                        >
                          All Products
                        </h2>
                      </div>
                      {/* Search */}
                      <div style={{ position: 'relative' }}>
                        <span
                          style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.75rem',
                            color: 'var(--c-muted)',
                            pointerEvents: 'none',
                          }}
                        >
                          <IconSearch className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                          placeholder="Search..."
                          style={{
                            paddingLeft: '2.25rem',
                            paddingRight: searchTerm ? '2rem' : '1rem',
                            paddingTop: '0.6rem',
                            paddingBottom: '0.6rem',
                            fontSize: '0.8rem',
                            background: 'var(--c-surface)',
                            border: '1px solid var(--c-border)',
                            color: 'var(--c-text)',
                            borderRadius: '8px',
                            width: '14rem',
                            outline: 'none',
                          }}
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <IconClose className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category Chips */}
                    <div
                      style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.75rem' }}
                      className="scrollbar-none"
                    >
                      <button
                        onClick={() => { setSelectedCategory(''); setCurrentPage(1); }}
                        className="font-display"
                        style={{
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          padding: '0.4rem 1rem',
                          border: '1px solid var(--c-border)',
                          borderRadius: '9999px',
                          color: selectedCategory === '' ? '#0a0908' : 'var(--c-muted)',
                          background: selectedCategory === '' ? 'var(--c-gold)' : 'transparent',
                          fontWeight: selectedCategory === '' ? 700 : 400,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                      >
                        All
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                          className="font-display"
                          style={{
                            flexShrink: 0,
                            fontSize: '0.75rem',
                            padding: '0.4rem 1rem',
                            border: '1px solid var(--c-border)',
                            borderRadius: '9999px',
                            color: selectedCategory === cat ? '#0a0908' : 'var(--c-muted)',
                            background: selectedCategory === cat ? 'var(--c-gold)' : 'transparent',
                            fontWeight: selectedCategory === cat ? 700 : 400,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  {/* Left Sidebar Filters */}
                    <aside className="lg:col-span-1">
                      <div className="p-5 rounded-2xl border shadow-xs space-y-6 sticky top-24 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                        <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
                          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 font-display" style={{ color: 'var(--c-gold)' }}>
                            <IconFilter className="w-4 h-4" />
                            <span>Filters</span>
                          </h3>
                          {(selectedCategory || searchTerm || minPrice || maxPrice || inStockOnly) && (
                            <button
                              onClick={clearAllFilters}
                              className="text-xs font-bold underline transition cursor-pointer"
                              style={{ color: 'var(--c-gold)' }}
                            >
                              Clear All
                            </button>
                          )}
                        </div>

                        {/* Category List */}
                        <div>
                          <label className="text-xs font-bold block mb-2 uppercase tracking-widest font-display" style={{ color: 'var(--c-muted)' }}>
                            Categories
                          </label>
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            <button
                              onClick={() => {
                                setSelectedCategory('');
                                setCurrentPage(1);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                selectedCategory === ''
                                  ? 'font-bold'
                                  : ''
                              }`}
                              style={{
                                background: selectedCategory === '' ? 'var(--c-gold-dim)' : 'transparent',
                                color: selectedCategory === '' ? 'var(--c-gold)' : 'var(--c-muted)',
                              }}
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
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                  selectedCategory === cat
                                    ? 'font-bold'
                                    : ''
                                }`}
                                style={{
                                  background: selectedCategory === cat ? 'var(--c-gold-dim)' : 'transparent',
                                  color: selectedCategory === cat ? 'var(--c-gold)' : 'var(--c-muted)',
                                }}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Price Range Filter */}
                        <div className="pt-4 border-t space-y-2" style={{ borderColor: 'var(--c-border-soft)' }}>
                          <label className="text-xs font-bold block uppercase tracking-widest font-display" style={{ color: 'var(--c-muted)' }}>
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
                                className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
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
                                className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* In Stock Toggle */}
                        <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--c-border-soft)' }}>
                          <label htmlFor="inStockFilter" className="text-xs font-bold cursor-pointer font-display" style={{ color: 'var(--c-text-dim)' }}>
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
                            className="w-4 h-4 rounded cursor-pointer accent-amber-600"
                          />
                        </div>

                        {/* Result Count */}
                        <div className="pt-4 border-t text-xs font-medium flex justify-between items-center" style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
                          <span>Products found:</span>
                          <span className="font-bold px-2.5 py-0.5 rounded-full font-display" style={{ background: 'var(--c-surface2)', color: 'var(--c-gold)' }}>
                            {error ? 'N/A' : filteredProducts.length}
                          </span>
                        </div>
                      </div>
                    </aside>

                    {/* Right Product Catalog */}
                    <div className="lg:col-span-3">
                      {/* Sort bar */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                        <span style={{ fontSize: '0.8rem', color: 'var(--c-muted)' }}>
                          {selectedCategory ? (
                            <><span className="font-display font-bold" style={{ color: 'var(--c-text)' }}>{selectedCategory}</span> · {filteredProducts.length} products</>
                          ) : (
                            <><span className="font-display font-bold" style={{ color: 'var(--c-text)' }}>All Products</span> · {filteredProducts.length} products</>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '0.75rem', color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>Sort by:</span>
                          <select
                            value={sortOption}
                            onChange={(e) => { setSortOption(e.target.value as any); setCurrentPage(1); }}
                            style={{
                              padding: '0.4rem 0.75rem', fontSize: '0.78rem',
                              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                              color: 'var(--c-text)', borderRadius: '6px', outline: 'none', cursor: 'pointer',
                            }}
                          >
                            <option value="newest">Recommended</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="name_asc">A to Z</option>
                            <option value="name_desc">Z to A</option>
                          </select>
                        </div>
                      </div>

                      {/* Loading */}
                      {loading && (
                        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--c-muted)', fontSize: '0.875rem' }}>
                          Loading catalog...
                        </div>
                      )}

                      {/* Error */}
                      {!loading && error && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--c-surface)', borderRadius: '12px', border: '1px solid var(--c-status-red-bg)' }}>
                          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                          <p className="font-display" style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '0.5rem' }}>Unable to load products</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--c-muted)', marginBottom: '1rem' }}>{error}</p>
                          <button onClick={handleRetry} className="font-display" style={{ padding: '0.6rem 1.5rem', fontSize: '0.8rem', fontWeight: 700, background: 'var(--c-gold)', color: '#0a0908', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Retry</button>
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && !error && filteredProducts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '6rem 0' }}>
                          <p className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--c-text)', marginBottom: '0.5rem' }}>Nothing here.</p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--c-muted)', marginBottom: '1.5rem' }}>Try adjusting your filters.</p>
                          <button onClick={clearAllFilters} className="font-display" style={{ padding: '0.6rem 1.5rem', fontSize: '0.8rem', fontWeight: 700, background: 'var(--c-gold)', color: '#0a0908', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Clear Filters</button>
                        </div>
                      )}

                      {/* Product Grid — Figma-accurate layout */}
                      {!loading && !error && filteredProducts.length > 0 && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                            {filteredProducts.map((product) => {
                              const available = product.inventory?.available ?? 10;
                              const canAdd = available > 0;
                              const imageSrc = getImageUrl(product.image_url || (product as any).imageUrl);
                              const merchantName = (product as any).merchant_name || (product as any).merchant || 'RazorShop';

                              return (
                                <div
                                  key={product.id}
                                  onClick={() => handleSelectProduct(product)}
                                  className="reveal themed group"
                                  style={{ background: 'var(--c-surface)', borderRadius: '12px', border: '1px solid var(--c-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)'; e.currentTarget.style.borderColor = 'var(--c-gold)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--c-border)'; }}
                                >
                                  {/* Full-bleed image */}
                                  <div style={{ position: 'relative', height: '180px', background: 'var(--c-surface2)', overflow: 'hidden', flexShrink: 0 }}>
                                    {imageSrc ? (
                                      <img src={imageSrc} alt={product.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85, transition: 'transform 0.3s ease' }} className="group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'var(--c-muted)' }}>📦</div>
                                    )}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px', background: 'linear-gradient(transparent, var(--c-surface))', pointerEvents: 'none' }} />
                                    {available > 15 && <div className="font-display" style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', background: 'rgba(201,150,58,0.18)', color: 'var(--c-gold)' }}>POPULAR</div>}
                                    {available > 0 && available <= 5 && <div className="font-display" style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', background: 'rgba(251,146,60,0.18)', color: 'var(--c-status-orange-text)' }}>ONLY {available} LEFT</div>}
                                  </div>

                                  {/* Card body */}
                                  <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <p className="font-display" style={{ fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--c-gold)' }}>{product.category || 'General'}</p>
                                    <h3 className="font-display" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--c-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.description || 'No description available.'}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                      <span style={{ color: 'var(--c-gold)', fontSize: '0.75rem' }}>★★★★★</span>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--c-muted)' }}>4.7 · 312</span>
                                    </div>
                                    <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                      <p className="font-display" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>{formatPrice(product.price_cents)}</p>
                                      <p style={{ fontSize: '0.7rem', color: 'var(--c-muted)', marginTop: '2px' }}>by {merchantName}</p>
                                    </div>
                                  </div>

                                  {/* Card footer buttons */}
                                  <div style={{ padding: '0 1rem 1rem', display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={(e) => { e.stopPropagation(); handleSelectProduct(product); }} className="themed font-display" style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.78rem', fontWeight: 500, border: '1px solid var(--c-border)', borderRadius: '6px', color: 'var(--c-text-dim)', background: 'transparent', cursor: 'pointer', transition: 'border-color 0.2s, color 0.2s' }} onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--c-gold)'; (e.target as HTMLElement).style.color = 'var(--c-gold)'; }} onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--c-border)'; (e.target as HTMLElement).style.color = 'var(--c-text-dim)'; }}>View</button>
                                    <button disabled={!canAdd} onClick={(e) => { e.stopPropagation(); if (canAdd) addToCart(product.id); }} className="font-display" style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.78rem', fontWeight: 600, borderRadius: '6px', border: 'none', background: canAdd ? 'var(--c-gold)' : 'var(--c-surface2)', color: canAdd ? '#0a0908' : 'var(--c-muted)', cursor: canAdd ? 'pointer' : 'not-allowed' }} onMouseEnter={(e) => { if (canAdd) (e.target as HTMLElement).style.opacity = '0.85'; }} onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}>{canAdd ? 'Add' : 'Sold Out'}</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination */}
                          {pagination.pages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', paddingTop: '2rem' }}>
                              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                                <button key={page} onClick={() => setCurrentPage(page)} className="font-display" style={{ padding: '0.5rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--c-border)', background: currentPage === page ? 'var(--c-gold)' : 'var(--c-surface)', color: currentPage === page ? '#0a0908' : 'var(--c-text-dim)', cursor: 'pointer' }}>
                                  {page}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
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
        onOpenForSellers={handleForSellersClick}
        onOpenAdminLogin={handleAdminLoginClick}
      />
    </div>
  )}

  {/* Global Authentication Modal */}
  <SignInModal
    isOpen={isAuthModalOpen}
    onClose={() => setIsAuthModalOpen(false)}
    initialTab={authModalTab}
    onLoginSuccess={handleLoginSuccess}
  />
</div>
);
}
