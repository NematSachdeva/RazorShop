import { useState } from 'react';
import { authService } from '../services/authService';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Mode management: 'login' | 'customer_register' | 'merchant_register'
  const [mode, setMode] = useState<'login' | 'customer_register' | 'merchant_register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await authService.login(email.trim(), password);
      } else if (mode === 'customer_register') {
        await authService.register(email.trim(), password, name.trim(), 'customer');
      } else if (mode === 'merchant_register') {
        await authService.register(
          email.trim(),
          password,
          name.trim(),
          'merchant',
          businessName.trim(),
          reason.trim()
        );
      }
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'customer_register' | 'merchant_register') => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100 max-h-[90vh] overflow-y-auto font-sans">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <span className="text-3xl font-black tracking-tight text-blue-900">RAZOR</span>
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">
            Autonomous E-Commerce Platform
          </span>
        </div>

        <h2 className="text-xl font-extrabold mb-1 text-gray-900 text-center">
          {mode === 'login' && 'Sign In to Your Account'}
          {mode === 'customer_register' && 'Create Customer Account'}
          {mode === 'merchant_register' && 'Merchant Partner Application'}
        </h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          {mode === 'login' && 'Enter your registered credentials to access your store or portal.'}
          {mode === 'customer_register' && 'Sign up for instant access to shopping and order history.'}
          {mode === 'merchant_register' && 'Submit an application for administrator review and onboarding.'}
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'login' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
                placeholder="Jane Doe"
              />
            </div>
          )}

          {mode === 'merchant_register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Store / Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                  placeholder="Acme Artisan Goods"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Reason for Requesting Merchant Access *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                  placeholder="Provide details about your store, business catalog, and products..."
                />
              </div>
            </>
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
              placeholder="name@example.com"
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
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-12"
                required
                placeholder={mode === 'login' ? '••••••••' : 'Min 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 font-extrabold text-white text-sm rounded-xl transition shadow-md disabled:opacity-50 ${
              mode === 'merchant_register'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'customer_register'
              ? 'Create Customer Account'
              : 'Submit Merchant Application'}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-xs text-center space-y-2">
          {mode === 'login' ? (
            <>
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => switchMode('customer_register')}
                  className="text-blue-600 hover:text-blue-800 font-bold underline"
                >
                  Create Account
                </button>
              </p>
              <p className="text-gray-500 pt-1">
                Interested in selling on Razor?{' '}
                <button
                  onClick={() => switchMode('merchant_register')}
                  className="text-purple-600 hover:text-purple-800 font-bold underline"
                >
                  Apply for Merchant Access
                </button>
              </p>
            </>
          ) : (
            <p className="text-gray-600">
              Already registered?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-blue-600 hover:text-blue-800 font-bold underline"
              >
                Sign In Instead
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
