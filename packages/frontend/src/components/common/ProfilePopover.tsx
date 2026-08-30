import { useState, useRef, useEffect } from 'react';

interface Props {
  user: {
    id?: string;
    name?: string;
    email: string;
    role: 'customer' | 'merchant' | 'admin';
  };
  onLogout: () => void;
  onNavigateToOrders?: () => void;
  onOpenCart?: () => void;
  onNavigateToStore?: () => void;
  onNavigateToMerchant?: () => void;
}

export default function ProfilePopover({
  user,
  onLogout,
  onNavigateToOrders,
  onOpenCart,
  onNavigateToStore,
  onNavigateToMerchant,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user.name || user.email.split('@')[0];
  const initial = (displayName.charAt(0) || 'U').toUpperCase();
  const isMerchant = user.role === 'merchant';

  // Handle click outside and Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-label="User Profile Menu"
      >
        <div
          className={`w-9 h-9 rounded-full font-extrabold text-sm flex items-center justify-center shadow-sm text-white ${
            isMerchant
              ? 'bg-gradient-to-tr from-purple-600 to-indigo-600'
              : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
          }`}
        >
          {initial}
        </div>
        <span className="hidden md:inline-block text-xs font-semibold text-gray-700 max-w-[120px] truncate">
          {displayName}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <div className="mt-2">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isMerchant
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {isMerchant ? '🏬 Merchant Account' : '🛒 Customer Account'}
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
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>🛍️</span>
                <span>Browse Store</span>
              </button>
            )}

            {!isMerchant && onNavigateToOrders && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToOrders();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>📦</span>
                <span>My Orders</span>
              </button>
            )}

            {!isMerchant && onOpenCart && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCart();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>🛒</span>
                <span>Shopping Cart</span>
              </button>
            )}

            {isMerchant && onNavigateToMerchant && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToMerchant();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <span>📊</span>
                <span>Merchant Portal</span>
              </button>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-1 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
