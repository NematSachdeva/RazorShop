import React, { useState, useEffect } from 'react';
import { authService, User } from '../services/authService';
import { IconClose } from './common/Icons';

export type AuthTab = 'customer' | 'seller' | 'admin';
export type CustomerSubMode = 'login' | 'register';
export type SellerSubMode = 'login' | 'register';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
  onLoginSuccess: (user: User) => void;
}

export default function SignInModal({
  isOpen,
  onClose,
  initialTab = 'customer',
  onLoginSuccess,
}: SignInModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [customerSubMode, setCustomerSubMode] = useState<CustomerSubMode>('login');
  const [sellerSubMode, setSellerSubMode] = useState<SellerSubMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
      setEmail('');
      setPassword('');
      setName('');
      setBusinessName('');
      setReason('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      let res;
      if (activeTab === 'customer') {
        if (customerSubMode === 'login') {
          res = await authService.login(email.trim(), password);
        } else {
          res = await authService.register(email.trim(), password, name.trim(), 'customer');
        }
      } else if (activeTab === 'seller') {
        if (sellerSubMode === 'login') {
          res = await authService.login(email.trim(), password);
        } else {
          res = await authService.register(
            email.trim(),
            password,
            name.trim(),
            'merchant',
            businessName.trim(),
            reason.trim()
          );
        }
      } else {
        res = await authService.login(email.trim(), password);
      }

      const loggedInUser: User = {
        id: res.id,
        email: res.email,
        name: res.name,
        role: res.role,
        application_id: res.application_id,
        application_status: res.application_status,
      };

      onLoginSuccess(loggedInUser);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const isRegistering =
    (activeTab === 'customer' && customerSubMode === 'register') ||
    (activeTab === 'seller' && sellerSubMode === 'register');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 space-y-5 p-6 sm:p-8 max-h-[90vh] overflow-y-auto themed"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        {/* Header & Close Button */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2 select-none">
            <span className="font-display text-2xl font-black tracking-tight" style={{ color: 'var(--c-text)' }}>
              Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
            </span>
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)' }}
            >
              Sign In
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition cursor-pointer"
            style={{ color: 'var(--c-muted)', background: 'transparent' }}
            title="Close Sign In"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl text-xs font-bold" style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border-soft)' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('customer');
              setError(null);
            }}
            className="py-2 px-1 rounded-lg text-center transition-all cursor-pointer font-display"
            style={{
              background: activeTab === 'customer' ? 'var(--c-gold)' : 'transparent',
              color: activeTab === 'customer' ? '#0a0908' : 'var(--c-muted)',
            }}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('seller');
              setError(null);
            }}
            className="py-2 px-1 rounded-lg text-center transition-all cursor-pointer font-display"
            style={{
              background: activeTab === 'seller' ? 'var(--c-gold)' : 'transparent',
              color: activeTab === 'seller' ? '#0a0908' : 'var(--c-muted)',
            }}
          >
            For Sellers
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError(null);
            }}
            className="py-2 px-1 rounded-lg text-center transition-all cursor-pointer font-display"
            style={{
              background: activeTab === 'admin' ? 'var(--c-gold)' : 'transparent',
              color: activeTab === 'admin' ? '#0a0908' : 'var(--c-muted)',
            }}
          >
            Admin Login
          </button>
        </div>

        {/* Tab Sub-header */}
        <div className="text-center pt-1">
          <h3 className="font-display text-xl font-bold" style={{ color: 'var(--c-text)' }}>
            {activeTab === 'customer' &&
              (customerSubMode === 'login' ? 'Customer Sign In' : 'Create Customer Account')}
            {activeTab === 'seller' &&
              (sellerSubMode === 'login' ? 'Seller Sign In' : 'Seller Partner Application')}
            {activeTab === 'admin' && 'Administrator Portal'}
          </h3>
          <p className="text-xs mt-1 font-medium" style={{ color: 'var(--c-muted)' }}>
            {activeTab === 'customer' &&
              (customerSubMode === 'login'
                ? 'Sign in to access your orders and shopping cart.'
                : 'Create an account to track orders and shop seamlessly.')}
            {activeTab === 'seller' &&
              (sellerSubMode === 'login'
                ? 'Sign in to access your Seller Dashboard.'
                : 'Submit your application to become a seller partner.')}
            {activeTab === 'admin' && 'Sign in with administrator credentials.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="p-3.5 rounded-xl text-xs font-bold space-y-2"
            style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            {(error.includes('already registered') || error.includes('EMAIL_ALREADY_REGISTERED')) && isRegistering && (
              <div className="pt-1 border-t border-red-500/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'customer') setCustomerSubMode('login');
                    if (activeTab === 'seller') setSellerSubMode('login');
                    setError(null);
                  }}
                  className="px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer"
                  style={{ background: 'var(--c-gold)', color: '#0a0908' }}
                >
                  Sign In Instead →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                required
                placeholder="Jane Doe"
              />
            </div>
          )}

          {activeTab === 'seller' && sellerSubMode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>
                  Store / Business Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  required
                  placeholder="Acme Artisan Goods"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>
                  Reason for Requesting Seller Access *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                  required
                  placeholder="Tell us about your products and business catalog..."
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
              required
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--c-text-dim)' }}>
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 pr-16"
                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                required
                placeholder={!isRegistering ? '••••••••' : 'Min 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-xs font-bold px-1 py-0.5 rounded transition cursor-pointer"
                style={{ color: 'var(--c-muted)' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 font-bold text-sm rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer font-display"
            style={{ background: 'var(--c-gold)', color: '#0a0908' }}
          >
            {loading
              ? 'Processing...'
              : activeTab === 'customer'
              ? customerSubMode === 'login'
                ? 'Sign In as Customer'
                : 'Create Customer Account'
              : activeTab === 'seller'
              ? sellerSubMode === 'login'
                ? 'Sign In to Seller Dashboard'
                : 'Submit Seller Application'
              : 'Sign In as Admin'}
          </button>
        </form>

        {/* Footer Sub-mode Toggle */}
        <div className="pt-4 border-t text-xs text-center space-y-2 font-medium" style={{ borderColor: 'var(--c-border)' }}>
          {activeTab === 'customer' && (
            <p style={{ color: 'var(--c-muted)' }}>
              {customerSubMode === 'login' ? (
                <>
                  Don't have a customer account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSubMode('register');
                      setError(null);
                    }}
                    className="font-bold transition cursor-pointer"
                    style={{ color: 'var(--c-gold)' }}
                  >
                    Create Account
                  </button>
                </>
              ) : (
                <>
                  Already have a customer account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSubMode('login');
                      setError(null);
                    }}
                    className="font-bold transition cursor-pointer"
                    style={{ color: 'var(--c-gold)' }}
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          )}

          {activeTab === 'seller' && (
            <p style={{ color: 'var(--c-muted)' }}>
              {sellerSubMode === 'login' ? (
                <>
                  Want to sell on RazorShop?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSellerSubMode('register');
                      setError(null);
                    }}
                    className="font-bold transition cursor-pointer"
                    style={{ color: 'var(--c-gold)' }}
                  >
                    Apply for Seller Account
                  </button>
                </>
              ) : (
                <>
                  Already registered as a seller?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSellerSubMode('login');
                      setError(null);
                    }}
                    className="font-bold transition cursor-pointer"
                    style={{ color: 'var(--c-gold)' }}
                  >
                    Sign In to Seller Portal
                  </button>
                </>
              )}
            </p>
          )}

          <div className="pt-2 flex items-center justify-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={onClose}
              className="underline transition cursor-pointer"
              style={{ color: 'var(--c-muted)' }}
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
