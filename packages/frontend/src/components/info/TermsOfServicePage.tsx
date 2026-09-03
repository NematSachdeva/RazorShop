import { IconInfo } from '../common/Icons';

export function TermsOfServicePage() {
  return (
    <div className="w-full py-10 font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border p-6 sm:p-10 space-y-8 themed shadow-xl" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
              <IconInfo className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                RazorShop Legal Terms
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mt-0.5" style={{ color: 'var(--c-text)' }}>
                Terms of Service
              </h1>
            </div>
          </div>

          <div className="max-w-none space-y-6 text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--c-text-dim)' }}>
            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>1. User Agreement</h2>
              <p>
                By creating an account, browsing the RazorShop catalog, or placing an order, you agree to bound by these terms and conditions. If you do not agree to all terms, you may not access or use the application.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>2. Account Responsibilities</h2>
              <p>
                Customers are responsible for maintaining the confidentiality of their login credentials and for restricting unauthorized access to their devices. You agree to accept responsibility for all activities that occur under your customer account.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>3. Products & Pricing</h2>
              <p>
                All prices on RazorShop are quoted in Indian Rupees (₹). Product descriptions, inventory availability, and pricing are maintained in real-time. RazorShop reserves the right to correct genuine typographical errors or system glitches in catalog listings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>4. Orders</h2>
              <p>
                Placing an item in your shopping cart does not reserve inventory until an order is created and payment is processed. An order confirmation acknowledges receipt of your request.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>5. Payments</h2>
              <p>
                Payments are securely processed via Razorpay gateway integration. In the event of a payment failure or gateway timeout, customers may retry or continue payment directly from their Orders history dashboard.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>6. Fulfillment & Delivery</h2>
              <p>
                Orders are dispatched by authorized sellers according to order timeline milestones (*Order Confirmed*, *Dispatched*, *Delivered*). Estimated delivery dates are displayed on order tracking pages.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>7. Refunds & Cancellations</h2>
              <p>
                Eligible refunds or order cancellations are evaluated in accordance with seller store policies and payment gateway refund settlement procedures.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>8. Seller Fulfillment</h2>
              <p>
                RazorShop provides platform infrastructure connecting customers with verified sellers. Sellers must maintain active compliance approval and inventory accuracy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>9. Customer Support</h2>
              <p>
                Our customer support team is available to assist with order inquiries, shipping updates, or billing questions. Please email support at nnnnsachdeva@gmail.com.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>10. Contact Information</h2>
              <div className="p-4 rounded-xl border inline-block mt-2" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                <span className="text-xs font-semibold block" style={{ color: 'var(--c-muted)' }}>Official Support Email</span>
                <a
                  href="mailto:nnnnsachdeva@gmail.com"
                  className="text-sm font-bold underline block mt-0.5"
                  style={{ color: 'var(--c-gold)' }}
                >
                  nnnnsachdeva@gmail.com
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
