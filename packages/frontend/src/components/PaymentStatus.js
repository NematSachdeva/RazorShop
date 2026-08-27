import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PaymentStatus({ status }) {
    const getStatusMessage = () => {
        switch (status) {
            case 'loading':
                return 'Initializing payment...';
            case 'ready':
                return 'Ready for payment';
            case 'processing':
                return 'Processing payment...';
            case 'verifying':
                return 'Verifying payment...';
            case 'complete':
                return 'Payment complete!';
            case 'failed':
                return 'Payment failed';
            default:
                return 'Unknown status';
        }
    };
    const getStatusColor = () => {
        switch (status) {
            case 'loading':
                return 'text-blue-600';
            case 'ready':
                return 'text-blue-600';
            case 'processing':
                return 'text-yellow-600';
            case 'verifying':
                return 'text-yellow-600';
            case 'complete':
                return 'text-green-600';
            case 'failed':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };
    const getSpinner = () => {
        if (status === 'loading' || status === 'processing' || status === 'verifying') {
            return (_jsx("div", { className: "inline-block animate-spin mr-2", children: _jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }) }));
        }
        return null;
    };
    return (_jsx("div", { className: `p-4 rounded-lg border mb-6 text-center ${getStatusColor()} border-current border-opacity-20`, children: _jsxs("div", { className: `${getStatusColor()} font-medium flex items-center justify-center gap-2`, children: [getSpinner(), _jsx("span", { children: getStatusMessage() })] }) }));
}
