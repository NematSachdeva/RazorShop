import { useState, useRef, useEffect } from 'react';
import { IconStore, IconPackage, IconCart, IconUser } from './Icons';

interface ProfilePopoverProps {
  user: {
    email: string;
    first_name?: string;
    last_name?: string;
    merchant_id?: string;
    role?: string;
  };
  onLogout: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToStore?: () => void;
  onNavigateToAddresses?: () => void;
  onOpenCart?: () => void;
  onNavigateToMerchant?: () => void;
}

export default function ProfilePopover({
  user,
  onLogout,
  onNavigateToOrders,
  onNavigateToStore,
  onNavigateToAddresses: _onNavigateToAddresses,
  onOpenCart,
  onNavigateToMerchant,
}: ProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const initial = (user.first_name?.[0] || user.email[0] || 'U').toUpperCase();

  const role = user.role || (user.merchant_id ? 'merchant' : 'customer');
  const isMerchant = role === 'merchant' || Boolean(user.merchant_id);
  const isAdmin = role === 'admin';

  const roleLabel = isAdmin
    ? 'ADMIN ACCOUNT'
    : isMerchant
    ? 'MERCHANT ACCOUNT'
    : 'CUSTOMER ACCOUNT';

  return (
    <div className="relative inline-block text-left font-sans" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-display"
        style={{
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-display"
          style={{ background: 'var(--c-gold)', color: '#0a0908' }}
        >
          {initial}
        </div>
        <span className="hidden md:inline-block text-xs font-semibold max-w-[120px] truncate" style={{ color: 'var(--c-text)' }}>
          {displayName}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl z-50 py-2 animate-fadeIn font-sans themed"
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          {/* User Info Header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--c-border-soft)' }}>
            <p className="text-sm font-bold truncate font-display" style={{ color: 'var(--c-text)' }}>{displayName}</p>
            <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>{user.email}</p>
            <div className="mt-2">
              <span
                className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-display"
                style={{
                  background: isAdmin
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isMerchant
                    ? 'var(--c-status-blue-bg)'
                    : 'var(--c-status-amber-bg)',
                  color: isAdmin
                    ? '#ef4444'
                    : isMerchant
                    ? 'var(--c-status-blue-text)'
                    : 'var(--c-status-amber-text)',
                  border: '1px solid var(--c-border-soft)',
                }}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Actions List */}
          <div className="py-1">
            {!isMerchant && onNavigateToStore && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToStore();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2.5 cursor-pointer font-display transition-colors"
                style={{ color: 'var(--c-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <IconStore className="w-4 h-4 text-[var(--c-gold)]" />
                <span>Browse Store</span>
              </button>
            )}

            {!isMerchant && onNavigateToOrders && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToOrders();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2.5 cursor-pointer font-display transition-colors"
                style={{ color: 'var(--c-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <IconPackage className="w-4 h-4 text-[var(--c-gold)]" />
                <span>My Orders</span>
              </button>
            )}

            {!isMerchant && onOpenCart && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCart();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2.5 cursor-pointer font-display transition-colors"
                style={{ color: 'var(--c-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <IconCart className="w-4 h-4 text-[var(--c-gold)]" />
                <span>Shopping Cart</span>
              </button>
            )}

            {isMerchant && onNavigateToMerchant && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToMerchant();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2.5 cursor-pointer font-display transition-colors"
                style={{ color: 'var(--c-text)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <IconUser className="w-4 h-4 text-[var(--c-gold)]" />
                <span>Merchant Portal</span>
              </button>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-1 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2.5 cursor-pointer font-display transition-colors"
              style={{ color: 'var(--c-status-red-text)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-status-red-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg className="w-4 h-4 text-[var(--c-status-red-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
