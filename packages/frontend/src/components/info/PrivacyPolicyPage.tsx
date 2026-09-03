import { IconShield } from '../common/Icons';

export function PrivacyPolicyPage() {
  return (
    <div className="w-full py-10 font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl border p-6 sm:p-10 space-y-8 themed shadow-xl" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}>
              <IconShield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                RazorShop Documentation
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mt-0.5" style={{ color: 'var(--c-text)' }}>
                Privacy Policy
              </h1>
            </div>
          </div>

          <div className="max-w-none space-y-6 text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--c-text-dim)' }}>
            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>1. Information We Collect</h2>
              <p>
                RazorShop collects essential customer information necessary to fulfill ecommerce transactions and provide an optimal customer experience. This includes personal identifiers such as your full name, email address, saved delivery shipping addresses, contact telephone numbers, and item purchase history.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>2. How Information Is Used</h2>
              <p>
                We use collected information strictly to process product orders, manage customer carts, calculate appropriate taxes and shipping parameters, dispatch transactional email order notifications, and present relevant complementary product catalog recommendations.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>3. Payment Information</h2>
              <p>
                Payment processing is managed securely using Razorpay payment gateway integration. RazorShop does not process, record, or store unencrypted financial credit card details or bank credentials on server infrastructure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>4. Data Sharing & Third Parties</h2>
              <p>
                Your personal customer details are never sold, rented, or distributed to third-party marketing companies. Customer address details are shared only with approved store sellers and verified fulfillment services strictly to facilitate package dispatch and delivery.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>5. Data Security</h2>
              <p>
                We employ industry-standard encryption protocol protections (HTTPS/TLS) and secure database access policies to protect customer account state and order history against unauthorized access, loss, or disclosure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>6. Customer Rights</h2>
              <p>
                Customers maintain complete rights to access, inspect, modify, or delete their saved shipping addresses and account profile records at any time through the customer dashboard or by contacting customer support.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
              <h2 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>7. Contact Customer Support</h2>
              <p>
                For any privacy questions, data protection requests, or inquiries regarding store practices, please contact our support team directly:
              </p>
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
