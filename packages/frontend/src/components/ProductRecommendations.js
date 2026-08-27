import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
export default function ProductRecommendations({ productId, className = '', }) {
    const [recommendations, setRecommendations] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const response = await fetch(getApiUrl(`/recommendations/products/${productId}?limit=5`));
                const data = await response.json();
                if (!response.ok) {
                    // Non-critical failure - don't break the page
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
                console.warn('Failed to fetch recommendations:', err);
                setError(err instanceof Error ? err.message : 'Failed to load recommendations');
            }
            finally {
                setLoading(false);
            }
        };
        if (productId) {
            fetchRecommendations();
        }
    }, [productId]);
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    };
    const handleTrackClick = async (recommendationId) => {
        try {
            // Track the click event
            await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_type: 'clicked' }),
            });
        }
        catch (err) {
            console.warn('Failed to track click event:', err);
        }
    };
    const handleAddToCart = async (productId, recommendationId) => {
        try {
            const response = await fetch(getApiUrl('/carts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity: 1 }),
            });
            if (response.ok) {
                // Track added_to_cart event
                await fetch(getApiUrl(`/recommendations/${recommendationId}/events`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_type: 'added_to_cart' }),
                });
            }
        }
        catch (err) {
            console.warn('Failed to add to cart:', err);
        }
    };
    if (loading) {
        return (_jsx("div", { className: `bg-gray-50 p-4 rounded-lg ${className}`, children: _jsxs("div", { className: "flex items-center justify-center py-4", children: [_jsx("div", { className: "animate-spin mr-2", children: _jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }) }), _jsx("span", { className: "text-gray-600", children: "Finding similar products..." })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: `bg-gray-50 p-4 rounded-lg ${className}`, children: _jsx("p", { className: "text-sm text-gray-600", children: "Recommendations temporarily unavailable. Try again later." }) }));
    }
    if (products.length === 0) {
        return (_jsx("div", { className: `bg-gray-50 p-4 rounded-lg ${className}`, children: _jsx("p", { className: "text-sm text-gray-500", children: "No similar products found at this time." }) }));
    }
    return (_jsxs("div", { className: `bg-gray-50 p-4 rounded-lg ${className}`, children: [_jsx("h3", { className: "text-lg font-bold mb-4 text-gray-900", children: "Similar Products" }), _jsx("div", { className: "space-y-3", children: products.map((product) => (_jsxs("div", { className: "flex items-start p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-gray-900", children: product.name }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [product.description?.substring(0, 100), "..."] }), _jsx("p", { className: "text-lg font-semibold text-blue-600 mt-2", children: formatPrice(product.price_cents) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleTrackClick(recommendations[0]?.id || ''), className: "px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100", children: "View" }), _jsx("button", { onClick: () => handleAddToCart(product.id, recommendations[0]?.id || ''), className: "px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200", children: "Add" })] })] }, product.id))) }), recommendations[0]?.reasoning && (_jsxs("div", { className: "mt-4 text-xs text-gray-500", children: [_jsx("p", { className: "font-medium mb-1", children: "AI Reasoning:" }), _jsx("p", { children: recommendations[0].reasoning.explanation }), _jsxs("p", { className: "mt-1", children: ["Confidence: ", (recommendations[0].reasoning.confidence * 100).toFixed(0), "%"] })] }))] }));
}
