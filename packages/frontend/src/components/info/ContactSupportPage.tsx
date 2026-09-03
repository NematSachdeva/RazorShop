import { IconPhone, IconInfo, IconPackage, IconCart, IconUser, IconShield } from '../common/Icons';

export function ContactSupportPage() {
  return (
    <div className="w-full py-10 font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border p-6 sm:p-10 space-y-8 themed shadow-xl" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
              <IconPhone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                RazorShop Customer Assistance
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mt-0.5" style={{ color: 'var(--c-text)' }}>
                Contact Support
              </h1>
            </div>
          </div>

          <div className="space-y-6">
            {/* Primary Contact Card */}
            <div className="p-6 rounded-2xl border space-y-3" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>
                Need help with your RazorShop order?
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--c-text-dim)' }}>
                Our support team is dedicated to assisting you with order tracking, payment verification, address updates, or general store inquiries.
              </p>

              <div className="pt-3 border-t" style={{ borderColor: 'var(--c-border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-gold)' }}>
                  Official Support Email
                </span>
                <a
                  href="mailto:nnnnsachdeva@gmail.com"
                  className="text-base sm:text-lg font-bold underline block mt-0.5"
                  style={{ color: 'var(--c-gold)' }}
                >
                  nnnnsachdeva@gmail.com
                </a>
              </div>
            </div>

            {/* Support Topics Grid */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)' }}>
                Support Topics We Assist With
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border space-y-1.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm font-display" style={{ color: 'var(--c-text)' }}>
                    <IconPackage className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Order & Shipping Issues</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                    Track dispatches, check fulfillment timeline updates, or report missing items.
                  </p>
                </div>

                <div className="p-4 rounded-xl border space-y-1.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm font-display" style={{ color: 'var(--c-text)' }}>
                    <IconCart className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Payment & Billing</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                    Resolve failed payment attempts, verify gateway transactions, or check refund statuses.
                  </p>
                </div>

                <div className="p-4 rounded-xl border space-y-1.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm font-display" style={{ color: 'var(--c-text)' }}>
                    <IconUser className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Account & Addresses</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                    Manage saved delivery addresses, default shipping choices, or account profile details.
                  </p>
                </div>

                <div className="p-4 rounded-xl border space-y-1.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm font-display" style={{ color: 'var(--c-text)' }}>
                    <IconShield className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Store Policies & Safety</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                    Inquire about privacy protections, terms of service, or seller compliance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border text-xs flex items-start gap-2.5" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}>
              <IconInfo className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <p>
                Support email inquiries sent to <strong style={{ color: 'var(--c-text)' }}>nnnnsachdeva@gmail.com</strong> are reviewed promptly within 24 business hours. Please include your order number where applicable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
