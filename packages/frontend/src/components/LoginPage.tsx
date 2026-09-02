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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-block select-none">
            <span className="text-3xl font-black tracking-tight text-gray-900">
              Razor<span className="text-blue-600">Shop</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Your store, orders, and commerce operations in one place.
          </p>
        </div>

        {/* Form Title & Subtitle */}
        <div className="text-center pb-1">
          <h2 className="text-xl font-black text-gray-900">
            {mode === 'login' && 'Sign In to Your Account'}
            {mode === 'customer_register' && 'Create Customer Account'}
            {mode === 'merchant_register' && 'Merchant Partner Application'}
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {mode === 'login' && 'Enter your credentials to continue.'}
            {mode === 'customer_register' && 'Sign up for instant access to shopping and order history.'}
            {mode === 'merchant_register' && 'Submit an application for administrator review and onboarding.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold space-y-2">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            {(error.includes('already registered') || error.includes('EMAIL_ALREADY_REGISTERED')) && mode !== 'login' && (
              <div className="pt-1 border-t border-rose-200/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[11px] font-extrabold transition cursor-pointer"
                >
                  Sign In Instead →
                </button>
              </div>
            )}
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
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm font-medium text-gray-900"
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
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm font-medium text-gray-900"
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
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm font-medium text-gray-900"
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
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm font-medium text-gray-900"
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
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-sm font-medium text-gray-900 pr-16"
                required
                placeholder={mode === 'login' ? '••••••••' : 'Min 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-xs text-gray-500 hover:text-gray-800 font-bold px-1 py-0.5 rounded transition"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl transition shadow-xs disabled:opacity-50 active:scale-[0.99]"
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
        <div className="pt-5 border-t border-gray-100 text-xs text-center space-y-2 font-medium">
          {mode === 'login' ? (
            <>
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('customer_register')}
                  className="text-blue-600 hover:text-blue-800 font-bold transition"
                >
                  Create Account
                </button>
              </p>
              <p className="text-gray-500 pt-1">
                Interested in selling on RazorShop?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('merchant_register')}
                  className="text-blue-600 hover:text-blue-800 font-bold transition"
                >
                  Apply for Merchant Access
                </button>
              </p>
            </>
          ) : (
            <p className="text-gray-600">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-blue-600 hover:text-blue-800 font-bold transition"
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
