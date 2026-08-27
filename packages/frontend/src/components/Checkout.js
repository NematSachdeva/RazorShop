import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { getApiUrl } from '../config/api';
export default function Checkout({ cart, customerId, onOrderCreated, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const handleCreateOrder = async () => {
        if (!cart.id) {
            setError('Cart is invalid');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(getApiUrl('/orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cart_id: cart.id,
                    customer_id: customerId,
                }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create order');
            }
            const order = await response.json();
            onOrderCreated(order.id, order.total_cents);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setLoading(false);
        }
    };
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Order Summary" }), _jsx("div", { className: "bg-gray-50 p-4 rounded-lg mb-6 max-h-64 overflow-y-auto", children: cart.items.map((item) => (_jsxs("div", { className: "flex justify-between mb-3 pb-3 border-b", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: item.product.name }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Qty: ", item.quantity] })] }), _jsx("p", { className: "font-semibold text-gray-900", children: formatPrice(item.line_total_cents) })] }, item.product_id))) }), _jsx("div", { className: "border-t pt-4 mb-6", children: _jsxs("div", { className: "flex justify-between text-lg", children: [_jsx("p", { className: "font-bold", children: "Total:" }), _jsx("p", { className: "font-bold text-blue-600", children: formatPrice(cart.total_cents) })] }) }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm", children: error })), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, disabled: loading, className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50", children: "Cancel" }), _jsx("button", { onClick: handleCreateOrder, disabled: loading, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50", children: loading ? 'Creating Order...' : 'Proceed to Payment' })] }), _jsx("p", { className: "text-xs text-gray-600 text-center mt-4", children: "You will be redirected to complete payment after creating the order." })] }) }));
}
