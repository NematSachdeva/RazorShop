import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
export default function OrderConfirmation({ orderId, onDone }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const response = await fetch(getApiUrl(`/orders/${orderId}`));
                if (!response.ok) {
                    throw new Error('Failed to load order');
                }
                const data = await response.json();
                setOrder(data);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
            finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    if (loading) {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center", children: [_jsx("div", { className: "animate-spin inline-block mb-4", children: _jsxs("svg", { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }) }), _jsx("p", { className: "text-gray-600", children: "Loading order details..." })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h2", { className: "text-xl font-bold text-red-600 mb-4", children: "Error Loading Order" }), _jsx("p", { className: "text-gray-600 mb-6", children: error }), _jsx("button", { onClick: onDone, className: "w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Back to Store" })] }) }));
    }
    if (!order) {
        return null;
    }
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "text-5xl mb-3", children: "\u2713" }), _jsx("h2", { className: "text-3xl font-bold text-green-600 mb-2", children: "Order Confirmed!" }), _jsx("p", { className: "text-gray-600", children: "Thank you for your purchase" })] }), _jsx("div", { className: "bg-gray-50 p-6 rounded-lg mb-6", children: _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Order Number" }), _jsx("p", { className: "text-lg font-mono font-semibold", children: order.order_number })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Order Status" }), _jsx("p", { className: "text-lg font-semibold capitalize", children: _jsx("span", { className: "inline-block px-3 py-1 bg-green-100 text-green-800 rounded", children: order.status }) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Order Date" }), _jsx("p", { className: "text-base", children: formatDate(order.created_at) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Order ID" }), _jsxs("p", { className: "text-sm font-mono text-gray-600", children: [orderId.slice(0, 16), "..."] })] })] }) }), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Order Items" }), _jsx("div", { className: "space-y-3", children: order.items.map((item, idx) => (_jsxs("div", { className: "flex justify-between items-center p-3 bg-gray-50 rounded", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-medium text-gray-900", children: ["Product ID: ", item.product_id.slice(0, 8), "..."] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Quantity: ", item.quantity] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-semibold", children: formatPrice(item.line_total_cents) }), _jsxs("p", { className: "text-xs text-gray-600", children: ["@ ", formatPrice(item.price_cents), " each"] })] })] }, idx))) })] }), _jsxs("div", { className: "border-t pt-4 mb-6", children: [_jsxs("div", { className: "flex justify-between mb-2 text-gray-600", children: [_jsx("p", { children: "Subtotal:" }), _jsx("p", { children: formatPrice(order.total_cents) })] }), _jsxs("div", { className: "flex justify-between text-lg font-bold", children: [_jsx("p", { children: "Order Total:" }), _jsx("p", { className: "text-blue-600", children: formatPrice(order.total_cents) })] })] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6", children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Next Steps:" }), " Your order has been confirmed and is now being prepared. You will receive an email confirmation shortly."] }) }), _jsx("button", { onClick: onDone, className: "w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700", children: "Continue Shopping" })] }) }));
}
