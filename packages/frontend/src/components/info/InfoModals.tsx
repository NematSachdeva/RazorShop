import { useEffect, useState } from 'react';
import { getApiUrl } from '../../config/api';
import { IconClose, IconShield, IconInfo, IconPhone, IconCheck, IconRefresh } from '../common/Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative my-auto max-h-[85vh] overflow-y-auto border border-gray-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
          aria-label="Close"
        >
          <IconClose className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <IconShield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Privacy Policy</h2>
            <p className="text-xs text-gray-500">RazorShop Customer Data Protection Policy</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">1. Information Collection</h3>
            <p>
              RazorShop collects essential customer information including name, email address, saved shipping addresses, and order history solely to process orders, facilitate fulfillment, and improve catalog recommendations.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">2. Payment Security</h3>
            <p>
              All payment transactions are encrypted and processed securely via Razorpay gateway services. RazorShop does not store raw credit card credentials or sensitive financial security keys on local servers.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">3. Data Sharing & Third Parties</h3>
            <p>
              Your personal information is never sold to third-party advertisers. Data is only shared with approved merchants and fulfillment partners strictly necessary to complete order delivery and email notifications.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">4. Your Rights</h3>
            <p>
              You have full control over your saved addresses and order history. To request data deletion or update your profile details, contact customer support at nnnnsachdeva@gmail.com.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

export function TermsOfServiceModal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative my-auto max-h-[85vh] overflow-y-auto border border-gray-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
          aria-label="Close"
        >
          <IconClose className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <IconInfo className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Terms of Service</h2>
            <p className="text-xs text-gray-500">RazorShop Platform Terms & Conditions</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">1. User Agreement</h3>
            <p>
              By accessing and using RazorShop, you agree to comply with our store policies, standard ordering protocols, and payment guidelines.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">2. Ordering & Pricing</h3>
            <p>
              All prices are listed in Indian Rupees (₹). Product availability and pricing are subject to real-time inventory updates. RazorShop reserves the right to modify catalog listings or cancel orders affected by genuine technical pricing glitches.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">3. Fulfillment & Deliveries</h3>
            <p>
              Estimated delivery dates and timeline stages are tracked via order management services. Merchants are responsible for accurate dispatch and tracking status updates.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 text-sm mb-1">4. Refund & Cancellation Policy</h3>
            <p>
              Refund requests for failed transactions or eligible returns are processed in accordance with payment Gateway rules and merchant verification.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            I Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactSupportModal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative my-auto border border-gray-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
          aria-label="Close"
        >
          <IconClose className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <IconPhone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Customer Support</h2>
            <p className="text-xs text-gray-500">We are here to assist you</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-gray-700">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <p className="font-semibold text-gray-900">Need assistance with your order?</p>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions regarding your active cart, order tracking, address changes, or refunds, feel free to reach out directly:
            </p>
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-500 block text-[11px] uppercase tracking-wider font-bold">Official Support Email</span>
              <a
                href="mailto:nnnnsachdeva@gmail.com"
                className="text-blue-600 hover:text-blue-800 font-bold text-sm underline block mt-0.5"
              >
                nnnnsachdeva@gmail.com
              </a>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-800 text-xs flex items-start gap-2">
            <IconInfo className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>Support requests are typically answered within 24 business hours.</p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApiStatusModal({ isOpen, onClose }: ModalProps) {
  const [statusData, setStatusData] = useState<{
    status: string;
    database: string;
    timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/health'));
      if (response.ok) {
        const data = await response.json();
        setStatusData(data);
      } else {
        setError('API service reported non-200 status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach health endpoint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealthStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative my-auto border border-gray-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
          aria-label="Close"
        >
          <IconClose className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 pr-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">API Status</h2>
            <p className="text-xs text-gray-500">Live Service Health Diagnostics</p>
          </div>
          <button
            onClick={fetchHealthStatus}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Refresh Status"
          >
            <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && (
          <div className="text-center py-8 text-xs text-gray-500">
            Checking backend health services...
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs">
            <p className="font-bold mb-1">System Health Alert</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && statusData && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-900">Core Services</span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <IconCheck className="w-3 h-3" />
                  {statusData.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-800 font-medium">Database Connection</span>
                <span className="font-mono font-bold text-emerald-900">{statusData.database}</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-gray-500 flex justify-between items-center font-mono">
              <span>Timestamp:</span>
              <span>{new Date(statusData.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
