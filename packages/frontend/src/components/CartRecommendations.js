import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
export default function CartRecommendations({ cartId, currentProductIds, onAddToCart, }) {
    const [recommendations, setRecommendations] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const response = await fetch(getApiUrl(`/recommendations/carts/${cartId}`));
                const data = await response.json();
                if (!response.ok) {
                    // Non-critical failure
                    if (response.status === 404 || response.status === 503) {
                        setLoading(false);
                        return;
                    }
                    throw new Error(data.error || 'Failed to load recommendations');
                }
                setRecommendations(data.recommendations || []);
                setProducts(data.products || []);
            }
            catch (err) {
                console.warn('Failed to fetch cart recommendations:', err);
                setError(err instanceof Error ? err.message : 'Failed to load recommendations');
            }
            finally {
                setLoading(false);
            }
        };
        if (cartId) {
            fetchRecommendations();
        }
    }, [cartId]);
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    };
    const handleTrackClick = async (recommendationId) => {
        try {
            await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_type: 'clicked' }),
            });
        }
        catch (err) {
            console.warn('Failed to track click:', err);
        }
    };
    const handleAddToCart = async (product, recommendationId) => {
        try {
            const response = await fetch(getApiUrl('/carts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: product.id, quantity: 1 }),
            });
            if (response.ok) {
                await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_type: 'added_to_cart' }),
                });
                onAddToCart?.(product.id);
            }
        }
        catch (err) {
            console.warn('Failed to add to cart:', err);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "bg-gray-50 p-4 rounded-lg", children: _jsxs("div", { className: "flex items-center justify-center py-4", children: [_jsx("div", { className: "animate-spin mr-2", children: _jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }) }), _jsx("span", { className: "text-gray-600", children: "Checking complementary products..." })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "bg-gray-50 p-4 rounded-lg", children: _jsx("p", { className: "text-sm text-gray-600", children: "Recommendations temporarily unavailable." }) }));
    }
    if (products.length === 0) {
        return (_jsx("div", { className: "bg-gray-50 p-4 rounded-lg", children: _jsx("p", { className: "text-sm text-gray-500", children: "No complementary products found." }) }));
    }
    return (_jsxs("div", { className: "bg-gray-50 p-4 rounded-lg", children: [_jsx("h3", { className: "text-lg font-bold mb-4 text-gray-900", children: "Complementary Products" }), _jsx("div", { className: "space-y-3", children: products.map((product) => {
                    const alreadyInCart = currentProductIds.includes(product.id);
                    return (_jsxs("div", { className: `flex items-start p-3 rounded-lg border ${alreadyInCart ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200'}`, children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: `font-medium ${alreadyInCart ? 'text-gray-500' : 'text-gray-900'}`, children: product.name }), alreadyInCart && (_jsx("span", { className: "text-xs text-gray-500", children: "Already in cart" })), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [product.description?.substring(0, 100), "..."] }), _jsx("p", { className: "text-lg font-semibold text-blue-600 mt-2", children: formatPrice(product.price_cents) })] }), !alreadyInCart && (_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleTrackClick(recommendations[0]?.id || ''), className: "px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100", children: "View" }), _jsx("button", { onClick: () => {
                                            handleAddToCart(product, recommendations[0]?.id || '');
                                            onAddToCart?.(product.id);
                                        }, className: "px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700", children: "Add" })] }))] }, product.id));
                }) }), recommendations[0]?.reasoning && (_jsxs("div", { className: "mt-4 text-xs text-gray-500", children: [_jsx("p", { className: "font-medium mb-1", children: "AI Reasoning:" }), _jsx("p", { children: recommendations[0].reasoning.explanation })] }))] }));
}
