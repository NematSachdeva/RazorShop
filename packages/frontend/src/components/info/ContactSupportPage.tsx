import { IconPhone, IconInfo, IconPackage, IconCart, IconUser, IconShield } from '../common/Icons';

export function ContactSupportPage() {
  return (
    <div className="w-full bg-gray-50 py-10 font-sans">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <IconPhone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                RazorShop Customer Assistance
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5">
                Contact Support
              </h1>
            </div>
          </div>

          <div className="space-y-6">
            {/* Primary Contact Card */}
            <div className="p-6 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-3">
              <h2 className="text-base font-extrabold text-blue-950">
                Need help with your RazorShop order?
              </h2>
              <p className="text-xs sm:text-sm text-blue-900 leading-relaxed">
                Our support team is dedicated to assisting you with order tracking, payment verification, address updates, or general store inquiries.
              </p>

              <div className="pt-3 border-t border-blue-200/80">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                  Official Support Email
                </span>
                <a
                  href="mailto:nnnnsachdeva@gmail.com"
                  className="text-base sm:text-lg font-black text-blue-700 hover:text-blue-900 underline block mt-0.5"
                >
                  nnnnsachdeva@gmail.com
                </a>
              </div>
            </div>

            {/* Support Topics Grid */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                Support Topics We Assist With
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-xs sm:text-sm">
                    <IconPackage className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Order & Shipping Issues</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Track dispatches, check fulfillment timeline updates, or report missing items.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-xs sm:text-sm">
                    <IconCart className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Payment & Billing</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Resolve failed payment attempts, verify gateway transactions, or check refund statuses.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-xs sm:text-sm">
                    <IconUser className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Account & Addresses</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Manage saved delivery addresses, default shipping choices, or account profile details.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-xs sm:text-sm">
                    <IconShield className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Store Policies & Safety</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Inquire about privacy protections, terms of service, or merchant compliance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 flex items-start gap-2.5">
              <IconInfo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Support email inquiries sent to <strong className="text-gray-900">nnnnsachdeva@gmail.com</strong> are reviewed promptly within 24 business hours. Please include your order number where applicable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
