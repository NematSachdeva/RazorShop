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
}: FooterProps) {
  const inSidebarLayout = isMerchant || isAdmin;

  return (
    <footer className="w-full bg-white border-t border-gray-200 mt-auto font-sans text-gray-600">
      <div className={inSidebarLayout ? 'px-4 sm:px-6 lg:px-8 py-12' : 'mx-auto max-w-7xl px-4 sm:px-6 py-12'}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="space-y-3 md:col-span-1">
            <div
              onClick={onNavigateToStore}
              className="cursor-pointer inline-block"
            >
              <span className="text-2xl font-black tracking-tight text-gray-900">
                Razor<span className="text-blue-600">Shop</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              {isMerchant
                ? 'Empowering merchants with intelligent store management, real-time inventory tracking, and revenue recovery tools.'
                : isAdmin
                ? 'Platform administration dashboard for merchant application auditing, approval workflows, and compliance.'
                : 'Modern e-commerce platform delivering high quality products with seamless order tracking and instant checkout.'}
            </p>
          </div>

          {/* Shop & Account / Merchant Management / Admin Management */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              {isAdmin ? 'Admin Management' : 'Shop & Account'}
            </h3>
            <ul className="space-y-2 text-xs">
              {isMerchant ? (
                <>
                  <li>
                    <button
                      onClick={onNavigateToProducts || onNavigateToStore}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Store Catalog
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToMerchantOrders || onNavigateToOrders}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      My Orders & Tracking
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToRecoveryCases || onNavigateToStore}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Shopping Cart
                    </button>
                  </li>
                </>
              ) : isAdmin ? (
                <>
                  <li>
                    <button
                      onClick={onNavigateToApplications || onNavigateToStore}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Merchant Applications
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToPending || onNavigateToOrders}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Pending Reviews
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToApproved || onOpenCart}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Approved Merchants
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <button
                      onClick={onNavigateToStore}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Store Catalog
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onNavigateToOrders}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      My Orders & Tracking
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onOpenCart}
                      className="hover:text-blue-600 transition-colors font-medium text-left"
                    >
                      Shopping Cart
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Information
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-blue-600 transition-colors font-medium text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTerms}
                  className="hover:text-blue-600 transition-colors font-medium text-left"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenApiStatus}
                  className="hover:text-blue-600 transition-colors font-medium text-left"
                >
                  API Status
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Customer Support
            </h3>
            <p className="text-xs text-gray-500">Need assistance?</p>
            <button
              onClick={onOpenContact}
              className="inline-block text-xs font-bold text-blue-600 hover:text-blue-800 underline text-left"
            >
              Contact Support
            </button>
            <div className="pt-1">
              <span className="text-[11px] text-gray-400 block font-medium">Email:</span>
              <a
                href="mailto:nnnnsachdeva@gmail.com"
                className="text-xs font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                nnnnsachdeva@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© 2026 RazorShop. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={onOpenPrivacy} className="hover:text-blue-600 transition-colors">
              Privacy
            </button>
            <button onClick={onOpenTerms} className="hover:text-blue-600 transition-colors">
              Terms
            </button>
            <button onClick={onOpenApiStatus} className="hover:text-blue-600 transition-colors">
              Status
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
