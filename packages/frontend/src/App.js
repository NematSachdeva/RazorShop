import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from './config/api';
import Checkout from './components/Checkout';
import PaymentPage from './components/PaymentPage';
import OrderConfirmation from './components/OrderConfirmation';
import LoginPage from './components/LoginPage';
import { authService } from './services/authService';
export default function App() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cart, setCart] = useState({
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
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [pagination, setPagination] = useState({ total: 0, pages: 0 });
    // Authentication state
    const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
    const [user, setUser] = useState(authService.getUser());
    // View state management
    const [viewState, setViewState] = useState('browse');
    const [orderId, setOrderId] = useState(null);
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
            }
            catch (err) {
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
                    const data = await response.json();
                    setProducts(data.data);
                    setPagination({ total: data.total, pages: data.pages });
                }
                else {
                    setError('Failed to load products');
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
            finally {
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
                const newCart = await response.json();
                setCart(newCart);
                localStorage.setItem('cartId', newCart.id);
            }
        }
        catch (err) {
            console.error('Failed to load cart', err);
        }
    };
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    const addToCart = async (productId) => {
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
                    const newCart = await cartResponse.json();
                    setCart(newCart);
                    localStorage.setItem('cartId', newCart.id);
                }
                else {
                    alert('Failed to create cart');
                    return;
                }
            }
            catch (err) {
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
                const updatedCart = await response.json();
                setCart(updatedCart);
            }
            else {
                const data = await response.json();
                alert(data.error || 'Failed to add to cart');
            }
        }
        catch (err) {
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
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [!isAuthenticated && _jsx(LoginPage, { onLoginSuccess: () => {
                    setIsAuthenticated(true);
                    setUser(authService.getUser());
                    loadCart();
                } }), isAuthenticated && (_jsxs(_Fragment, { children: [_jsx("header", { className: "bg-white shadow sticky top-0 z-10", children: _jsxs("div", { className: "mx-auto max-w-7xl px-4 py-4 flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Razor Store" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("span", { className: "text-sm text-gray-600", children: ["Welcome, ", user?.name || user?.email] }), _jsxs("button", { onClick: () => setCartOpen(!cartOpen), className: "relative px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: ["Cart", cart && cart.items.length > 0 && (_jsx("span", { className: "absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center", children: cart.items.length }))] }), _jsx("button", { onClick: handleLogout, className: "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700", children: "Logout" })] })] }) }), _jsx("main", { className: "mx-auto max-w-7xl px-4 py-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-8", children: [_jsx("aside", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-white p-4 rounded shadow", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Filters" }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "text-sm font-medium text-gray-700 block mb-2", children: "Search" }), _jsx("input", { type: "text", value: searchTerm, onChange: (e) => { setSearchTerm(e.target.value); setCurrentPage(1); }, placeholder: "Search products...", className: "w-full px-3 py-2 border border-gray-300 rounded" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-700 block mb-2", children: "Category" }), _jsxs("select", { value: selectedCategory, onChange: (e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }, className: "w-full px-3 py-2 border border-gray-300 rounded", children: [_jsx("option", { value: "", children: "All Categories" }), categories.map((cat) => (_jsx("option", { value: cat, children: cat }, cat)))] })] })] }) }), _jsxs("div", { className: "lg:col-span-3", children: [loading && _jsx("p", { className: "text-center py-8", children: "Loading products..." }), error && _jsx("p", { className: "text-center py-8 text-red-600", children: error }), !loading && products.length === 0 && _jsx("p", { className: "text-center py-8", children: "No products found" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8", children: products.map((product) => (_jsxs("div", { className: "bg-white p-4 rounded shadow hover:shadow-lg transition", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-1 line-clamp-2", children: product.name }), _jsx("p", { className: "text-sm text-gray-600 mb-2 line-clamp-2", children: product.description }), _jsx("p", { className: "text-xs text-gray-500 mb-3", children: product.category }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-lg font-bold text-blue-600", children: formatPrice(product.price_cents) }), _jsx("button", { onClick: () => addToCart(product.id), className: "px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700", children: "Add" })] })] }, product.id))) }), pagination.pages > 1 && (_jsx("div", { className: "flex justify-center gap-2 mb-8", children: Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (_jsx("button", { onClick: () => setCurrentPage(page), className: `px-3 py-2 rounded ${currentPage === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: page }, page))) }))] })] }) }), cartOpen && (_jsxs("div", { className: "fixed right-0 top-0 h-full w-96 bg-white shadow-lg p-4 overflow-y-auto z-40", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Shopping Cart" }), cart && cart.items.length > 0 ? (_jsxs(_Fragment, { children: [cart.items.map((item) => (_jsxs("div", { className: "border-b py-2 mb-2", children: [_jsx("p", { className: "font-medium", children: item.product.name }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Qty: ", item.quantity] }), _jsx("p", { className: "text-blue-600 font-semibold", children: formatPrice(item.line_total_cents) })] }, item.product_id))), _jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsxs("p", { className: "text-lg font-bold mb-4", children: ["Total: ", formatPrice(cart.total_cents)] }), _jsx("button", { onClick: () => {
                                                    setCartOpen(false);
                                                    setViewState('checkout');
                                                }, className: "w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mb-2", children: "Proceed to Checkout" })] })] })) : (_jsx("p", { className: "text-gray-600", children: "Your cart is empty" })), _jsx("button", { onClick: () => setCartOpen(false), className: "mt-4 w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300", children: "Close" })] })), viewState === 'checkout' && cart && (_jsx(Checkout, { cart: cart, customerId: user?.id || '', onOrderCreated: (id, amount) => {
                            setOrderId(id);
                            setOrderAmount(amount);
                            setViewState('payment');
                        }, onCancel: () => setViewState('browse') })), viewState === 'payment' && orderId && (_jsx(PaymentPage, { orderId: orderId, amountCents: orderAmount, onPaymentComplete: (status) => {
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
                            }
                            else {
                                setViewState('browse');
                                setOrderId(null);
                            }
                        }, onCancel: () => {
                            setViewState('browse');
                            setOrderId(null);
                        } })), viewState === 'confirmation' && orderId && (_jsx(OrderConfirmation, { orderId: orderId, onDone: () => {
                            setViewState('browse');
                            setOrderId(null);
                            setOrderAmount(0);
                        } }))] }))] }));
}
