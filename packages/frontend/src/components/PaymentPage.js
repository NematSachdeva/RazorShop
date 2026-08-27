import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import PaymentStatus from './PaymentStatus';
export default function PaymentPage({ orderId, amountCents, onPaymentComplete, onCancel, }) {
    const [error, setError] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('loading');
    // Create payment attempt
    useEffect(() => {
        const createPayment = async () => {
            try {
                const response = await fetch(getApiUrl('/payments/create'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to create payment');
                }
                // Payment created successfully - response contains razorpay order details
                await response.json();
                setPaymentStatus('ready');
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create payment');
                setPaymentStatus('failed');
            }
        };
        createPayment();
    }, [orderId]);
    const handleTestPayment = async (success) => {
        // Simulated payment flow for testing
        // In production, this would integrate with actual Razorpay checkout
        setPaymentStatus('processing');
        if (success) {
            // Simulate payment success
            setTimeout(async () => {
                setPaymentStatus('verifying');
                // Mock payment verification
                const mockPaymentId = 'pay_test_' + Date.now();
                const mockSignature = 'mock_signature_' + Date.now();
                try {
                    const response = await fetch(getApiUrl('/payments/verify'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_id: orderId,
                            razorpay_payment_id: mockPaymentId,
                            razorpay_signature: mockSignature,
                        }),
                    });
                    if (response.ok) {
                        setPaymentStatus('complete');
                        onPaymentComplete('success');
                    }
                    else {
                        setPaymentStatus('failed');
                        setError('Payment verification failed');
                        onPaymentComplete('failed');
                    }
                }
                catch (err) {
                    setPaymentStatus('failed');
                    setError('Payment verification error');
                    onPaymentComplete('failed');
                }
            }, 2000);
        }
        else {
            // Simulate payment failure
            setPaymentStatus('failed');
            setError('Payment was declined');
            setTimeout(() => {
                onPaymentComplete('failed');
            }, 1500);
        }
    };
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    if (paymentStatus === 'complete') {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center", children: [_jsx("div", { className: "text-5xl mb-4", children: "\u2713" }), _jsx("h2", { className: "text-2xl font-bold text-green-600 mb-2", children: "Payment Successful!" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Your order has been confirmed." }), _jsxs("p", { className: "text-sm text-gray-500 mb-6", children: ["Order ID: ", orderId] }), _jsx("button", { onClick: () => onPaymentComplete('success'), className: "w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700", children: "Continue to Order" })] }) }));
    }
    if (paymentStatus === 'failed') {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center", children: [_jsx("div", { className: "text-5xl mb-4", children: "\u2715" }), _jsx("h2", { className: "text-2xl font-bold text-red-600 mb-2", children: "Payment Failed" }), _jsx("p", { className: "text-gray-600 mb-4", children: error }), _jsxs("p", { className: "text-sm text-gray-500 mb-6", children: ["Order ID: ", orderId] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300", children: "Cancel" }), _jsx("button", { onClick: () => {
                                    setPaymentStatus('ready');
                                    setError(null);
                                }, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Retry Payment" })] })] }) }));
    }
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Payment" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg mb-6", children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsx("p", { className: "text-gray-600", children: "Order Amount:" }), _jsx("p", { className: "font-semibold", children: formatPrice(amountCents) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("p", { className: "text-gray-600", children: "Order ID:" }), _jsxs("p", { className: "font-mono text-sm", children: [orderId.slice(0, 8), "..."] })] })] }), _jsx(PaymentStatus, { status: paymentStatus }), paymentStatus === 'ready' && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded p-4 mb-6", children: [_jsxs("p", { className: "text-sm text-blue-800 mb-4", children: [_jsx("strong", { children: "Test Mode:" }), " For demonstration purposes, you can simulate payment:"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleTestPayment(true), className: "flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700", children: "Simulate Success" }), _jsx("button", { onClick: () => handleTestPayment(false), className: "flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700", children: "Simulate Failure" })] })] })), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm", children: error })), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-sm text-yellow-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Note:" }), _jsx("p", { children: "This is a test implementation. In production, this would redirect to the actual Razorpay checkout." })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, disabled: paymentStatus === 'processing' || paymentStatus === 'verifying', className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50", children: "Cancel Payment" }), paymentStatus === 'ready' && (_jsx("button", { disabled: true, className: "flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed", children: "Razorpay (M4)" }))] })] }) }));
}
