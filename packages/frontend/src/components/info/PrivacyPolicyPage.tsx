import { IconShield } from '../common/Icons';

export function PrivacyPolicyPage() {
  return (
    <div className="w-full bg-gray-50 py-10 font-sans">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <IconShield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                RazorShop Documentation
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-0.5">
                Privacy Policy
              </h1>
            </div>
          </div>

          <div className="prose prose-blue max-w-none space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">1. Information We Collect</h2>
              <p>
                RazorShop collects essential customer information necessary to fulfill ecommerce transactions and provide an optimal customer experience. This includes personal identifiers such as your full name, email address, saved delivery shipping addresses, contact telephone numbers, and item purchase history.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">2. How Information Is Used</h2>
              <p>
                We use collected information strictly to process product orders, manage customer carts, calculate appropriate taxes and shipping parameters, dispatch transactional email order notifications, and present relevant complementary product catalog recommendations.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">3. Payment Information</h2>
              <p>
                Payment processing is managed securely using Razorpay payment gateway integration. RazorShop does not process, record, or store unencrypted financial credit card details or bank credentials on server infrastructure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">4. Data Sharing & Third Parties</h2>
              <p>
                Your personal customer details are never sold, rented, or distributed to third-party marketing companies. Customer address details are shared only with approved store merchants and verified fulfillment services strictly to facilitate package dispatch and delivery.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">5. Data Security</h2>
              <p>
                We employ industry-standard encryption protocol protections (HTTPS/TLS) and secure database access policies to protect customer account state and order history against unauthorized access, loss, or disclosure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900">6. Customer Rights</h2>
              <p>
                Customers maintain complete rights to access, inspect, modify, or delete their saved shipping addresses and account profile records at any time through the customer dashboard or by contacting customer support.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t border-gray-100">
              <h2 className="text-base font-extrabold text-gray-900">7. Contact Customer Support</h2>
              <p>
                For any privacy questions, data protection requests, or inquiries regarding store practices, please contact our support team directly:
              </p>
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
