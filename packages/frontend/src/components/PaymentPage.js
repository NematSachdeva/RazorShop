import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';
import PaymentStatus from './PaymentStatus';
/**
 * Load Razorpay Checkout script dynamically
 * Returns a promise that resolves when the script is loaded
 */
function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.Razorpay) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
            if (window.Razorpay) {
                resolve();
            }
            else {
                reject(new Error('Razorpay object not found after script load'));
            }
        };
        script.onerror = () => {
            reject(new Error('Failed to load Razorpay Checkout script'));
        };
        document.body.appendChild(script);
    });
}
export default function PaymentPage({ orderId, amountCents, onPaymentComplete, onCancel, }) {
    const [error, setError] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('loading');
    const [razorpayOrderId, setRazorpayOrderId] = useState(null);
    const [razorpayKeyId, setRazorpayKeyId] = useState(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [initializationAttempted, setInitializationAttempted] = useState(false);
    // Create payment attempt and load Razorpay script
    // Use a ref to track if initialization has already started to prevent React.StrictMode double-invoke
    useEffect(() => {
        // Skip if already attempted
        if (initializationAttempted) {
            return;
        }
        const initPayment = async () => {
            try {
                // Load Razorpay Checkout script
                await loadRazorpayScript();
                setScriptLoaded(true);
                // Create payment attempt on backend
                const response = await fetch(getApiUrl('/payments/create'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to create payment');
                }
                const paymentData = await response.json();
                setRazorpayOrderId(paymentData.razorpay_order_id);
                setRazorpayKeyId(paymentData.razorpay_key_id);
                setPaymentStatus('ready');
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to initialize payment');
                setPaymentStatus('failed');
            }
        };
        setInitializationAttempted(true);
        initPayment();
    }, [orderId, initializationAttempted]);
    const handleOpenRazorpay = async () => {
        if (!scriptLoaded || !window.Razorpay || !razorpayOrderId || !razorpayKeyId) {
            setError('Payment system not ready. Please try again.');
            return;
        }
        setPaymentStatus('processing');
        setError(null);
        try {
            const options = {
                key: razorpayKeyId,
                order_id: razorpayOrderId,
                name: 'Razor Store',
                description: `Order ${orderId.slice(0, 8)}...`,
                amount: amountCents,
                currency: 'INR',
                handler: async (response) => {
                    setPaymentStatus('verifying');
                    try {
                        // Verify payment on backend
                        const verifyResponse = await fetch(getApiUrl('/payments/verify'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                order_id: orderId,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });
                        if (!verifyResponse.ok) {
                            const data = await verifyResponse.json();
                            throw new Error(data.error || 'Payment verification failed');
                        }
                        setPaymentStatus('complete');
                        onPaymentComplete('success');
                    }
                    catch (err) {
                        setPaymentStatus('failed');
                        setError(err instanceof Error ? err.message : 'Payment verification error');
                        onPaymentComplete('failed');
                    }
                },
                modal: {
                    ondismiss: () => {
                        setPaymentStatus('ready');
                        setError('Payment cancelled');
                    },
                },
                theme: {
                    color: '#2563eb',
                },
            };
            const razorpay = new window.Razorpay(options);
            razorpay.open();
        }
        catch (err) {
            setPaymentStatus('failed');
            setError(err instanceof Error ? err.message : 'Failed to open payment gateway');
        }
    };
    const formatPrice = (cents) => {
        return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    if (paymentStatus === 'complete') {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center", children: [_jsx("div", { className: "text-5xl mb-4", children: "\u2713" }), _jsx("h2", { className: "text-2xl font-bold text-green-600 mb-2", children: "Payment Successful!" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Your order has been confirmed." }), _jsxs("p", { className: "text-sm text-gray-500 mb-6", children: ["Order ID: ", orderId] }), _jsx("button", { onClick: () => onPaymentComplete('success'), className: "w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700", children: "Continue to Order" })] }) }));
    }
    if (paymentStatus === 'failed') {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center", children: [_jsx("div", { className: "text-5xl mb-4", children: "\u2715" }), _jsx("h2", { className: "text-2xl font-bold text-red-600 mb-2", children: "Payment Failed" }), _jsx("p", { className: "text-gray-600 mb-4", children: error }), _jsxs("p", { className: "text-sm text-gray-500 mb-6", children: ["Order ID: ", orderId] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300", children: "Cancel" }), _jsx("button", { onClick: async () => {
                                    setError(null);
                                    setPaymentStatus('loading');
                                    try {
                                        // Create a new Razorpay order for retry
                                        const response = await fetch(getApiUrl('/payments/create'), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ order_id: orderId }),
                                        });
                                        if (!response.ok) {
                                            const data = await response.json();
                                            throw new Error(data.error || 'Failed to create payment');
                                        }
                                        const paymentData = await response.json();
                                        setRazorpayOrderId(paymentData.razorpay_order_id);
                                        setRazorpayKeyId(paymentData.razorpay_key_id);
                                        setPaymentStatus('ready');
                                    }
                                    catch (err) {
                                        setError(err instanceof Error ? err.message : 'Failed to retry payment');
                                        setPaymentStatus('failed');
                                    }
                                }, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Retry Payment" })] })] }) }));
    }
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Payment" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg mb-6", children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsx("p", { className: "text-gray-600", children: "Order Amount:" }), _jsx("p", { className: "font-semibold", children: formatPrice(amountCents) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("p", { className: "text-gray-600", children: "Order ID:" }), _jsxs("p", { className: "font-mono text-sm", children: [orderId.slice(0, 8), "..."] })] })] }), _jsx(PaymentStatus, { status: paymentStatus }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm", children: error })), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded p-3 mb-6 text-sm text-blue-800", children: [_jsx("p", { className: "font-medium mb-1", children: "Secure Payment:" }), _jsx("p", { children: "Your payment will be processed securely through Razorpay." })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: onCancel, disabled: paymentStatus === 'processing' || paymentStatus === 'verifying', className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50", children: "Cancel Payment" }), paymentStatus === 'ready' && (_jsx("button", { onClick: handleOpenRazorpay, disabled: !scriptLoaded, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50", children: "Pay Now" }))] })] }) }));
}
