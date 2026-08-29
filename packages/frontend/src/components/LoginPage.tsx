import { useState } from 'react';
import { authService } from '../services/authService';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  const [email, setEmail] = useState('customer@example.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  const handleRoleSwitch = (newRole: 'customer' | 'merchant') => {
    setRole(newRole);
    setError(null);
    if (newRole === 'merchant') {
      setEmail('merchant@example.com');
      setPassword('password123');
      setName('Demo Merchant');
    } else {
      setEmail('customer@example.com');
      setPassword('password123');
      setName('Demo Customer');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await authService.login(email, password);
      } else {
        await authService.register(email, password, name, role);
      }
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <span className="text-3xl font-black tracking-tight text-blue-900">RAZOR</span>
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">
            Autonomous E-Commerce Platform
          </span>
        </div>

        {/* Role Toggle Tabs */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => handleRoleSwitch('customer')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              role === 'customer'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🛒 Customer Account
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('merchant')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              role === 'merchant'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏬 Merchant Hub
          </button>
        </div>

        <h2 className="text-xl font-extrabold mb-4 text-gray-900 text-center">
          {role === 'merchant' ? 'Merchant Portal' : 'Customer Store'} — {isLogin ? 'Sign In' : 'Create Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required={!isLogin}
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                required
                placeholder={isLogin ? '' : 'Min 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-xs text-gray-500 hover:text-gray-700 font-semibold"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 font-bold text-white rounded-lg transition disabled:opacity-50 ${
              role === 'merchant' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Loading...' : isLogin ? `Login as ${role === 'merchant' ? 'Merchant' : 'Customer'}` : 'Register'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-3 text-center">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </p>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="w-full py-2 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200"
          >
            {isLogin ? 'Create New Account' : 'Switch to Login'}
          </button>
        </div>

        <div className={`mt-4 p-3 rounded-lg text-xs ${role === 'merchant' ? 'bg-purple-50 border border-purple-200 text-purple-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
          <p className="font-bold mb-1">Demo Credentials ({role}):</p>
          <p>Email: {role === 'merchant' ? 'merchant@example.com' : 'customer@example.com'}</p>
          <p>Password: password123</p>
        </div>
      </div>
    </div>
  );
}
