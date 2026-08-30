import { IconInfo } from '../common/Icons';

export function TermsOfServicePage() {
  return (
    <div className="w-full bg-gray-50 py-10 font-sans">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <IconInfo className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                RazorShop Legal Terms
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5">
                Terms of Service
              </h1>
            </div>
          </div>

          <div className="prose prose-blue max-w-none space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">1. User Agreement</h2>
              <p>
                By creating an account, browsing the RazorShop catalog, or placing an order, you agree to bound by these terms and conditions. If you do not agree to all terms, you may not access or use the application.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">2. Account Responsibilities</h2>
              <p>
                Customers are responsible for maintaining the confidentiality of their login credentials and for restricting unauthorized access to their devices. You agree to accept responsibility for all activities that occur under your customer account.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">3. Products & Pricing</h2>
              <p>
                All prices on RazorShop are quoted in Indian Rupees (₹). Product descriptions, inventory availability, and pricing are maintained in real-time. RazorShop reserves the right to correct genuine typographical errors or system glitches in catalog listings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">4. Orders</h2>
              <p>
                Placing an item in your shopping cart does not reserve inventory until an order is created and payment is processed. An order confirmation acknowledges receipt of your request.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">5. Payments</h2>
              <p>
                Payments are securely processed via Razorpay gateway integration. In the event of a payment failure or gateway timeout, customers may retry or continue payment directly from their Orders history dashboard.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">6. Fulfillment & Delivery</h2>
              <p>
                Orders are dispatched by authorized merchants according to order timeline milestones (*Order Confirmed*, *Dispatched*, *Delivered*). Estimated delivery dates are displayed on order tracking pages.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">7. Refunds & Cancellations</h2>
              <p>
                Eligible refunds or order cancellations are evaluated in accordance with merchant store policies and payment gateway refund settlement procedures.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">8. Merchant Fulfillment</h2>
              <p>
                RazorShop provides platform infrastructure connecting customers with verified merchants. Merchants must maintain active compliance approval and inventory accuracy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">9. Customer Support</h2>
              <p>
                Our customer support team is available to assist with order inquiries, shipping updates, or billing questions. Please email support at nnnnsachdeva@gmail.com.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t border-gray-100">
              <h2 className="text-base font-extrabold text-gray-900">10. Contact Information</h2>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 inline-block mt-2">
                <span className="text-xs text-gray-500 font-semibold block">Official Support Email</span>
                <a
                  href="mailto:nnnnsachdeva@gmail.com"
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 underline block mt-0.5"
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
