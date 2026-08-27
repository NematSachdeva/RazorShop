import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { authService } from '../services/authService';
export default function LoginPage({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('customer@example.com');
    const [password, setPassword] = useState('password123');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isLogin) {
                await authService.login(email, password);
            }
            else {
                await authService.register(email, password, name);
            }
            onLoginSuccess();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-8 w-full max-w-md", children: [_jsx("h2", { className: "text-2xl font-bold mb-6 text-gray-900", children: isLogin ? 'Login' : 'Register' }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [!isLogin && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Name" }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500", required: !isLogin })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500", required: true, placeholder: isLogin ? '' : 'Min 6 characters' })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50", children: loading ? 'Loading...' : isLogin ? 'Login' : 'Register' })] }), _jsxs("div", { className: "mt-6 pt-6 border-t", children: [_jsx("p", { className: "text-sm text-gray-600 mb-4", children: isLogin ? "Don't have an account?" : 'Already have an account?' }), _jsx("button", { onClick: () => {
                                setIsLogin(!isLogin);
                                setError(null);
                                setEmail('');
                                setPassword('');
                                setName('');
                            }, className: "w-full px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300", children: isLogin ? 'Create Account' : 'Login' })] }), _jsxs("div", { className: "mt-4 p-3 bg-blue-100 border border-blue-300 rounded text-sm text-blue-700", children: [_jsx("p", { className: "font-semibold mb-2", children: "Demo Credentials:" }), _jsx("p", { children: "Email: customer@example.com" }), _jsx("p", { children: "Password: password123" })] })] }) }));
}
