import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { authService } from '../services/authService';
import RevenueMetrics from './analytics/RevenueMetrics';
import RecoveryFunnel from './analytics/RecoveryFunnel';
import CustomerResponseBreakdown from './analytics/CustomerResponseBreakdown';
import PaymentFailureReasons from './analytics/PaymentFailureReasons';
import RevenueTimeline from './analytics/RevenueTimeline';
import RecoveryCasesList from './analytics/RecoveryCasesList';
import RecoveryCaseDetail from './analytics/RecoveryCaseDetail';
import InsightsFeed from './analytics/InsightsFeed';
import MerchantConfigUI from './analytics/MerchantConfigUI';
import MerchantProducts from './merchant/MerchantProducts';
import { MerchantOrdersTab } from './merchant/MerchantOrdersTab';
import Footer from './Footer';
import ProfilePopover from './common/ProfilePopover';
import {
  IconStore,
  IconPackage,
  IconCart,
  IconShield,
  IconInfo,
  IconRefresh,
  IconClose,
} from './common/Icons';

interface DashboardData {
  merchant_id: string;
  metrics: {
    total_revenue_cents: number;
    revenue_at_risk_cents: number;
    revenue_recovered_cents: number;
    failed_payments_count: number;
    failed_payments_total_cents: number;
    abandoned_carts_count: number;
    recovery_rate_percent: number;
    period: {
      start_date: string;
      end_date: string;
    };
  };
  funnel: {
    open: number;
    in_progress: number;
    resolved: number;
    abandoned: number;
    customer_declined: number;
    total: number;
    conversion_rates: {
      open_to_resolved: number;
      open_to_in_progress: number;
    };
  };
  response_breakdown: {
    accepted: number;
    refused: number;
    promised: number;
    unclear: number;
    total: number;
    percentages: {
      accepted: number;
      refused: number;
      promised: number;
      unclear: number;
    };
  };
  failure_reasons: {
    reasons: Array<{
      reason: string;
      count: number;
      total_amount_cents: number;
      recovery_count: number;
      recovery_rate_percent: number;
    }>;
    total_failures: number;
    total_amount_cents: number;
  };
  revenue_timeline: {
    data: Array<{
      date: string;
      revenue_cents: number;
      orders_count: number;
      failed_payments_count: number;
      recovered_amount_cents: number;
    }>;
    period: {
      start_date: string;
      end_date: string;
    };
    totals: {
      revenue_cents: number;
      orders_count: number;
      failed_payments_count: number;
      recovered_amount_cents: number;
    };
  };
}

type ViewState =
  | 'dashboard'
  | 'analytics'
  | 'products'
  | 'orders'
  | 'recovery-cases'
  | 'recovery-case-detail'
  | 'insights'
  | 'config';

interface MerchantDashboardProps {
  onLogout?: () => void;
  onShowApplicationTimeline?: () => void;
  onNavigateToPath?: (path: string) => void;
}

export default function MerchantDashboard({
  onLogout,
  onShowApplicationTimeline,
  onNavigateToPath,
}: MerchantDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRangeDays, setActiveRangeDays] = useState<number | 'prev_month' | 'custom'>(5);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const currentUser = authService.getUser();

  const handleRangeChange = (
    range: number | 'prev_month' | 'custom',
    customStart?: string,
    customEnd?: string
  ) => {
    setActiveRangeDays(range);
    const now = new Date();

    if (typeof range === 'number') {
      const start = new Date();
      start.setDate(now.getDate() - range);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (range === 'prev_month') {
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDayPrevMonth.toISOString().split('T')[0]);
      setEndDate(lastDayPrevMonth.toISOString().split('T')[0]);
    } else if (range === 'custom' && customStart && customEnd) {
      setStartDate(customStart);
      setEndDate(customEnd);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (startDate) query.append('start_date', startDate);
      if (endDate) query.append('end_date', endDate);

      const response = await fetch(getApiUrl(`/merchant/dashboard?${query}`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load merchant dashboard data');
      }

      const data: DashboardData = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [startDate, endDate]);

  const handleViewProducts = () => {
    setViewState('products');
    setMobileMenuOpen(false);
  };

  const handleViewRecoveryCases = () => {
    setSelectedCaseId(null);
    setViewState('recovery-cases');
    setMobileMenuOpen(false);
  };

  const handleViewCaseDetail = (caseId: string) => {
    setSelectedCaseId(caseId);
    setViewState('recovery-case-detail');
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      authService.logout();
      window.location.reload();
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IconStore },
    { id: 'analytics', label: 'Analytics', icon: IconInfo },
    { id: 'orders', label: 'Orders & Fulfillment', icon: IconPackage },
    { id: 'products', label: 'Products & Stock', icon: IconCart },
    { id: 'recovery-cases', label: 'Recovery Cases', icon: IconShield },
    { id: 'insights', label: 'Insights', icon: IconInfo },
    { id: 'config', label: 'Config', icon: IconInfo },
  ] as const;

  const sectionTitles: Record<ViewState, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Store Dashboard Overview',
      subtitle: 'Real-time sales performance, active catalog inventory, and revenue metrics.',
    },
    analytics: {
      title: 'Merchant Business Analytics',
      subtitle: 'Detailed revenue funnels, customer response breakdowns, and failure analysis.',
    },
    orders: {
      title: 'Orders & Fulfillment',
      subtitle: 'Track catalog customer orders, dispatch items, and manage fulfillment milestones.',
    },
    products: {
      title: 'Products & Stock Management',
      subtitle: 'Manage catalog item listings, prices, inventory levels, and stock on hand.',
    },
    'recovery-cases': {
      title: 'Revenue Recovery Cases',
      subtitle: 'Audit and process automated revenue recovery workflows for failed payments.',
    },
    'recovery-case-detail': {
      title: 'Recovery Case Audit Detail',
      subtitle: 'Inspect agent diagnostic decisions, customer activity, and recovery history.',
    },
    insights: {
      title: 'AI Insights & Recommendations',
      subtitle: 'Actionable catalog recommendations generated for your store.',
    },
    config: {
      title: 'Merchant Guard Rails & Settings',
      subtitle: 'Configure automated recovery thresholds, channels, and AI parameters.',
    },
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-5 font-sans">
      <div className="space-y-6">
        {/* Brand Logo Header */}
        <div className="pb-4 border-b border-gray-100">
          <div
            onClick={() => setViewState('dashboard')}
            className="cursor-pointer flex items-center gap-2 select-none"
            title="Merchant Dashboard Home"
          >
            <span className="text-2xl font-black tracking-tight text-gray-900">
              Razor<span className="text-blue-600">Shop</span>
            </span>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider block mt-1.5 w-fit">
            Merchant Portal
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 block px-3 mb-2">
            Merchant Management
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              viewState === item.id ||
              (item.id === 'recovery-cases' && viewState === 'recovery-case-detail');

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'recovery-cases') handleViewRecoveryCases();
                  else setViewState(item.id as ViewState);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-xs border-l-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Navigation Utilities */}
      <div className="pt-6 border-t border-gray-100 space-y-3">
        <a
          href="mailto:nnnnsachdeva@gmail.com"
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          <IconInfo className="w-4 h-4 text-gray-400" />
          <span>Support Contact</span>
        </a>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition"
        >
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex w-full font-sans text-gray-900">
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-white h-full z-10 shadow-2xl flex flex-col">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <IconClose className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Workspace Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                <IconStore className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                  RazorShop Merchant Portal
                </span>
                <h1 className="text-lg sm:text-xl font-black text-gray-900 mt-0.5">
                  {sectionTitles[viewState].title}
                </h1>
                <p className="text-xs text-gray-500 font-medium hidden sm:block">
                  {sectionTitles[viewState].subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {onShowApplicationTimeline && (
                <button
                  onClick={onShowApplicationTimeline}
                  className="px-3.5 py-2 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-xl transition"
                >
                  View Application Timeline
                </button>
              )}

              <button
                onClick={fetchDashboard}
                disabled={loading}
                className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {currentUser && (
                <ProfilePopover
                  user={currentUser}
                  onLogout={handleLogout}
                  onNavigateToMerchant={() => setViewState('dashboard')}
                />
              )}
            </div>
          </div>
        </header>

        {/* Workspace Body Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {viewState === 'orders' && <MerchantOrdersTab />}
          {viewState === 'products' && <MerchantProducts />}
          {viewState === 'recovery-cases' && (
            <RecoveryCasesList onCaseSelected={handleViewCaseDetail} />
          )}
          {viewState === 'recovery-case-detail' && selectedCaseId && (
            <RecoveryCaseDetail caseId={selectedCaseId} />
          )}
          {viewState === 'insights' && <InsightsFeed />}
          {viewState === 'config' && <MerchantConfigUI />}

          {(viewState === 'dashboard' || viewState === 'analytics') && (
            <>
              {/* Date Filter Control Box */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    />
                  </div>
                  <button
                    onClick={fetchDashboard}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-xs"
                  >
                    Apply Filter
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => handleRangeChange(5)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      activeRangeDays === 5
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    5 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange(14)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      activeRangeDays === 14
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    14 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange(30)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      activeRangeDays === 30
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 space-y-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium text-gray-500">Loading merchant dashboard metrics...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-xs text-rose-800 space-y-2">
                  <p className="font-bold text-sm">Dashboard Data Alert</p>
                  <p>{error}</p>
                  <button
                    onClick={fetchDashboard}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition"
                  >
                    Retry Loading
                  </button>
                </div>
              )}

              {/* Dashboard Content */}
              {!loading && dashboardData && (
                <div className="space-y-6">
                  {/* Revenue Metrics Cards */}
                  <RevenueMetrics metrics={dashboardData.metrics} />

                  {viewState === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <RecoveryFunnel funnel={dashboardData.funnel} />
                      <CustomerResponseBreakdown breakdown={dashboardData.response_breakdown} />
                    </div>
                  )}

                  {viewState === 'analytics' && (
                    <PaymentFailureReasons reasons={dashboardData.failure_reasons} />
                  )}

                  {/* Store Catalog & Inventory Overview Summary Card */}
                  {(dashboardData as any).inventory_summary && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
                      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-100 pb-4">
                        <div>
                          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
                            Authoritative Database Snapshot
                          </span>
                          <h3 className="text-xl font-black text-gray-900 mt-0.5">
                            Store Catalog & Inventory Overview
                          </h3>
                        </div>
                        <button
                          onClick={handleViewProducts}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          View All Products & Stock
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                          <p className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">
                            Products Listed
                          </p>
                          <p className="text-2xl font-black text-blue-950 mt-1">
                            {(dashboardData as any).inventory_summary.total_listed || 0}
                          </p>
                        </div>

                        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                          <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">
                            Stock Units
                          </p>
                          <p className="text-2xl font-black text-emerald-950 mt-1">
                            {(dashboardData as any).inventory_summary.total_units_in_stock || 0}
                          </p>
                        </div>

                        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                          <p className="text-[11px] text-amber-800 font-bold uppercase tracking-wider">
                            Low Stock
                          </p>
                          <p className="text-2xl font-black text-amber-950 mt-1">
                            {(dashboardData as any).inventory_summary.low_stock_count || 0}
                          </p>
                        </div>

                        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200">
                          <p className="text-[11px] text-rose-800 font-bold uppercase tracking-wider">
                            Out of Stock
                          </p>
                          <p className="text-2xl font-black text-rose-950 mt-1">
                            {(dashboardData as any).inventory_summary.out_of_stock_count || 0}
                          </p>
                        </div>

                        <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 col-span-2 md:col-span-1">
                          <p className="text-[11px] text-purple-800 font-bold uppercase tracking-wider">
                            Units Sold
                          </p>
                          <p className="text-2xl font-black text-purple-950 mt-1">
                            {(dashboardData as any).inventory_summary.total_sold || 0}
                          </p>
                        </div>
                      </div>

                      {/* Products Summary Table */}
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-3 px-4">Product Name</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4 text-right">Price</th>
                              <th className="py-3 px-4 text-center">Available Stock</th>
                              <th className="py-3 px-4 text-right">Units Sold</th>
                              <th className="py-3 px-4 text-center">Stock Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {((dashboardData as any).inventory_summary.products || []).map(
                              (item: any) => {
                                const available =
                                  item.available ??
                                  Math.max(
                                    0,
                                    (item.quantity_on_hand || 0) - (item.reserved || 0)
                                  );
                                const isLow = available > 0 && available <= 5;
                                const isOut = available === 0;

                                return (
                                  <tr key={item.id} className="hover:bg-gray-50 transition">
                                    <td className="py-3 px-4 font-bold text-gray-900">
                                      {item.name}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                        {item.category || 'General'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-blue-700">
                                      ₹{(item.price_cents / 100).toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4 text-center font-bold text-gray-900">
                                      {available}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                                      {item.units_sold}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {isOut ? (
                                        <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                                          Out of Stock
                                        </span>
                                      ) : isLow ? (
                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                                          Low Stock ({available})
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                                          In Stock
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Revenue Timeline */}
                  <RevenueTimeline
                    timeline={dashboardData.revenue_timeline}
                    activeRangeDays={activeRangeDays}
                    onRangeChange={handleRangeChange}
                    customStartDate={startDate}
                    customEndDate={endDate}
                  />
                </div>
              )}
            </>
          )}
        </main>

        <Footer
          isMerchant={true}
          onNavigateToStore={() => setViewState('dashboard')}
          onNavigateToOrders={() => setViewState('orders')}
          onOpenCart={() => setViewState('recovery-cases')}
          onNavigateToProducts={() => setViewState('products')}
          onNavigateToMerchantOrders={() => setViewState('orders')}
          onNavigateToRecoveryCases={() => setViewState('recovery-cases')}
          onOpenPrivacy={() => (onNavigateToPath ? onNavigateToPath('/privacy') : (window.location.href = '/privacy'))}
          onOpenTerms={() => (onNavigateToPath ? onNavigateToPath('/terms') : (window.location.href = '/terms'))}
          onOpenContact={() => (onNavigateToPath ? onNavigateToPath('/support') : (window.location.href = '/support'))}
          onOpenApiStatus={() => (onNavigateToPath ? onNavigateToPath('/status') : (window.location.href = '/status'))}
        />
      </div>
    </div>
  );
}
