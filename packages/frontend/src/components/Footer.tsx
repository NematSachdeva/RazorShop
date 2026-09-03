interface FooterProps {
  onNavigateToStore: () => void;
  onNavigateToOrders: () => void;
  onOpenCart: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenContact: () => void;
  onOpenApiStatus: () => void;
  isMerchant?: boolean;
  isAdmin?: boolean;
  onNavigateToProducts?: () => void;
  onNavigateToMerchantOrders?: () => void;
  onNavigateToRecoveryCases?: () => void;
  onNavigateToApplications?: () => void;
  onNavigateToPending?: () => void;
  onNavigateToApproved?: () => void;
  onOpenForSellers?: () => void;
  onOpenAdminLogin?: () => void;
}

export default function Footer({
  onNavigateToStore,
  onNavigateToOrders,
  onOpenCart,
  onOpenPrivacy,
  onOpenTerms,
  onOpenContact,
  onOpenApiStatus,
  isMerchant = false,
  isAdmin = false,
  onNavigateToProducts,
  onNavigateToMerchantOrders,
  onNavigateToRecoveryCases,
  onNavigateToApplications,
  onNavigateToPending,
  onNavigateToApproved,
  onOpenForSellers,
  onOpenAdminLogin,
}: FooterProps) {
  const inSidebarLayout = isMerchant || isAdmin;

  return (
    <footer
      className="w-full mt-auto font-sans themed"
      style={{
        background: 'var(--c-bg-deep)',
        borderTop: '1px solid var(--c-border)',
        color: 'var(--c-muted)',
      }}
    >
      <div className={inSidebarLayout ? 'px-4 sm:px-6 lg:px-8 py-12' : 'mx-auto max-w-7xl px-4 sm:px-6 py-12'}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-3 md:col-span-1">
            <div
              onClick={onNavigateToStore}
              className="cursor-pointer inline-block select-none"
            >
              <span className="font-display text-2xl font-black tracking-tight" style={{ color: 'var(--c-text)' }}>
                Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--c-muted)' }}>
              {isMerchant
                ? 'Empowering sellers with intelligent store management, real-time inventory tracking, and revenue recovery tools.'
                : isAdmin
                ? 'Platform administration dashboard for seller application auditing, approval workflows, and compliance.'
                : 'Modern e-commerce platform delivering high quality products with seamless order tracking and instant checkout.'}
            </p>
          </div>

          {/* Shop & Account / Seller Management / Admin Management */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: 'var(--c-gold)' }}>
              {isAdmin ? 'Admin Management' : isMerchant ? 'Seller Operations' : 'Shop & Account'}
            </h3>
            <ul className="space-y-2 text-xs">
              {isMerchant ? (
                <>
                  <li>
                    <button
                      onClick={onNavigateToProducts || onNavigateToStore}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Store Catalog
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToMerchantOrders || onNavigateToOrders}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Orders & Tracking
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToRecoveryCases || onNavigateToStore}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Revenue Recovery
                    </button>
                  </li>
                </>
              ) : isAdmin ? (
                <>
                  <li>
                    <button
                      onClick={onNavigateToApplications || onNavigateToStore}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Seller Applications
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToPending || onNavigateToOrders}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Pending Reviews
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToApproved || onOpenCart}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Approved Sellers
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button
                      onClick={onNavigateToStore}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Store Catalog
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToOrders}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      My Orders & Tracking
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onOpenCart}
                      className="nav-link font-medium text-left cursor-pointer"
                    >
                      Shopping Cart
                    </button>
                  </li>
                  {onOpenForSellers && (
                    <li>
                      <button
                        onClick={onOpenForSellers}
                        className="nav-link font-medium text-left cursor-pointer"
                        style={{ color: 'var(--c-gold)' }}
                      >
                        For Sellers / Seller Portal
                      </button>
                    </li>
                  )}
                  {onOpenAdminLogin && (
                    <li>
                      <button
                        onClick={onOpenAdminLogin}
                        className="nav-link font-medium text-left cursor-pointer"
                      >
                        Admin Portal
                      </button>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>

          {/* Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: 'var(--c-gold)' }}>
              Information
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="nav-link font-medium text-left cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTerms}
                  className="nav-link font-medium text-left cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenApiStatus}
                  className="nav-link font-medium text-left cursor-pointer"
                >
                  API Status
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: 'var(--c-gold)' }}>
              Customer Support
            </h3>
            <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Need assistance?</p>
            <button
              onClick={onOpenContact}
              className="inline-block text-xs font-bold underline text-left transition cursor-pointer"
              style={{ color: 'var(--c-gold)' }}
            >
              Contact Support
            </button>
            <div className="pt-1">
              <span className="text-[11px] block font-medium" style={{ color: 'var(--c-muted)' }}>Email:</span>
              <a
                href="mailto:nnnnsachdeva@gmail.com"
                className="text-xs font-bold transition-colors"
                style={{ color: 'var(--c-text-dim)' }}
              >
                nnnnsachdeva@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-xs" style={{ borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
          <p>© 2026 RazorShop. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={onOpenPrivacy} className="nav-link">
              Privacy
            </button>
            <button onClick={onOpenTerms} className="nav-link">
              Terms
            </button>
            <button onClick={onOpenApiStatus} className="nav-link">
              Status
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
