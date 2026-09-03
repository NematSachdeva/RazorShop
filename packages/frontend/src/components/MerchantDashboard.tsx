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
import MerchantHelper from './merchant/MerchantHelper';
import Footer from './Footer';
import ProfilePopover from './common/ProfilePopover';
import {
  IconStore,
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
    orders_cancelled_count?: number;
    orders_returned_count?: number;
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
  | 'merchant-helper'
  | 'config';

interface MerchantDashboardProps {
  onLogout?: () => void;
  onShowApplicationTimeline?: () => void;
  onNavigateToPath?: (path: string) => void;
}

export default function MerchantDashboard({
  onLogout,
  onShowApplicationTimeline: _onShowApplicationTimeline,
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

  const [isLightMode, setIsLightMode] = useState(() => document.documentElement.classList.contains('light'));

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

  const handleViewStore = () => {
    authService.logout();
    if (onLogout) {
      onLogout();
    }
    if (onNavigateToPath) {
      onNavigateToPath('/');
    } else {
      window.location.href = '/';
    }
  };

  const navItems = [
    { id: 'dashboard', num: '01', label: 'Dashboard' },
    { id: 'analytics', num: '02', label: 'Analytics' },
    { id: 'orders', num: '03', label: 'Orders & Fulfillment' },
    { id: 'products', num: '04', label: 'Products & Stock' },
    { id: 'recovery-cases', num: '05', label: 'Recovery Cases' },
    { id: 'insights', num: '06', label: 'Insights' },
    { id: 'merchant-helper', num: '07', label: 'Merchant Helper' },
  ] as const;

  const sectionTitles: Record<ViewState, { title: string; subtitle?: string }> = {
    dashboard: { title: 'Dashboard' },
    analytics: { title: 'Analytics' },
    orders: { title: 'Orders & Fulfillment' },
    products: { title: 'Products & Stock' },
    'recovery-cases': { title: 'Recovery Cases' },
    'recovery-case-detail': { title: 'Recovery Case Detail' },
    insights: { title: 'Insights' },
    'merchant-helper': { title: 'Merchant Helper' },
    config: { title: 'Merchant Settings' },
  };

  const renderSidebarContent = () => (
    <div className="p-6 flex flex-col justify-between h-full space-y-6 themed select-none" style={{ background: 'var(--c-surface)', color: 'var(--c-text)' }}>
      <div className="space-y-8">
        {/* Brand Logo Header */}
        <div>
          <div
            onClick={() => onNavigateToPath ? onNavigateToPath('/') : setViewState('dashboard')}
            className="cursor-pointer select-none"
            title="RazorShop Merchant Portal"
          >
            <span className="text-xl font-extrabold tracking-tight font-display" style={{ color: 'var(--c-text)' }}>
              Razor<span style={{ color: 'var(--c-gold)' }}>Shop</span>
            </span>
          </div>
          <span className="text-[11px] font-medium block mt-0.5 font-display" style={{ color: 'var(--c-muted)' }}>
            Merchant Portal
          </span>
        </div>

        {/* Numbered Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left font-display cursor-pointer"
                style={{
                  background: isActive ? 'var(--c-surface2)' : 'transparent',
                  color: isActive ? 'var(--c-gold)' : 'var(--c-muted)',
                }}
              >
                <span className="text-[11px] font-mono shrink-0" style={{ color: isActive ? 'var(--c-gold)' : 'var(--c-muted)' }}>
                  {item.num}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Navigation Links */}
      <div className="pt-6 border-t space-y-2 font-display text-xs" style={{ borderColor: 'var(--c-border-soft)' }}>
        <button
          onClick={() => setViewState('config')}
          className="w-full text-left px-3 py-1.5 font-medium transition cursor-pointer"
          style={{ color: viewState === 'config' ? 'var(--c-gold)' : 'var(--c-muted)' }}
        >
          Config
        </button>

        <a
          href="mailto:nnnnsachdeva@gmail.com"
          className="block px-3 py-1.5 font-medium transition"
          style={{ color: 'var(--c-muted)' }}
        >
          Support
        </a>

        <button
          onClick={handleViewStore}
          className="w-full text-left px-3 py-1.5 font-medium transition cursor-pointer"
          style={{ color: 'var(--c-muted)' }}
        >
          View Store
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full font-sans themed" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden lg:flex w-64 border-r shrink-0 sticky top-0 h-screen overflow-y-auto" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 h-full z-10 shadow-2xl flex flex-col" style={{ background: 'var(--c-surface)' }}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1"
              style={{ color: 'var(--c-muted)' }}
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
        <header className="sticky top-0 z-30 themed" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
          <div className="px-6 sm:px-8 py-5 flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border"
                style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
              >
                <IconStore className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
                  RAZORSHOP — MERCHANT PORTAL
                </span>
                <h1 className="text-2xl font-black mt-0.5 font-display tracking-tight" style={{ color: 'var(--c-text)' }}>
                  {sectionTitles[viewState].title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const isLight = document.documentElement.classList.contains('light');
                  if (isLight) {
                    document.documentElement.classList.remove('light');
                    localStorage.setItem('theme', 'dark');
                    setIsLightMode(false);
                  } else {
                    document.documentElement.classList.add('light');
                    localStorage.setItem('theme', 'light');
                    setIsLightMode(true);
                  }
                }}
                className="p-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-sm"
                style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-gold)' }}
                title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {isLightMode ? '🌙' : '☀️'}
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
        <main className="flex-1 px-6 sm:px-8 py-6 space-y-6">
          {viewState === 'orders' && <MerchantOrdersTab />}
          {viewState === 'products' && <MerchantProducts />}
          {viewState === 'recovery-cases' && (
            <RecoveryCasesList onCaseSelected={handleViewCaseDetail} />
          )}
          {viewState === 'recovery-case-detail' && selectedCaseId && (
            <RecoveryCaseDetail caseId={selectedCaseId} />
          )}
          {viewState === 'insights' && <InsightsFeed />}
          {viewState === 'merchant-helper' && <MerchantHelper />}
          {viewState === 'config' && <MerchantConfigUI />}

          {(viewState === 'dashboard' || viewState === 'analytics') && (
            <>
              {/* Date Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 font-sans">
                <div className="flex flex-wrap items-center gap-2 text-xs font-display">
                  <span className="text-xs mr-1" style={{ color: 'var(--c-muted)' }}>From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium focus:outline-none themed"
                    style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                  />
                  <span className="text-xs mx-1" style={{ color: 'var(--c-muted)' }}>To</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium focus:outline-none themed"
                    style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                  />
                  <button
                    onClick={fetchDashboard}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-display cursor-pointer"
                    style={{ background: 'var(--c-cta-bg)', color: 'var(--c-cta-text)' }}
                  >
                    Apply
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-display">
                  <button
                    onClick={() => handleRangeChange(5)}
                    className="px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer"
                    style={{
                      background: activeRangeDays === 5 ? 'var(--c-surface2)' : 'transparent',
                      borderColor: activeRangeDays === 5 ? 'var(--c-border)' : 'transparent',
                      color: activeRangeDays === 5 ? 'var(--c-text)' : 'var(--c-muted)',
                    }}
                  >
                    Last 5 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange(14)}
                    className="px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer"
                    style={{
                      background: activeRangeDays === 14 ? 'var(--c-surface2)' : 'transparent',
                      borderColor: activeRangeDays === 14 ? 'var(--c-border)' : 'transparent',
                      color: activeRangeDays === 14 ? 'var(--c-text)' : 'var(--c-muted)',
                    }}
                  >
                    Last 14 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange(30)}
                    className="px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer"
                    style={{
                      background: activeRangeDays === 30 ? 'var(--c-surface2)' : 'transparent',
                      borderColor: activeRangeDays === 30 ? 'var(--c-border)' : 'transparent',
                      color: activeRangeDays === 30 ? 'var(--c-text)' : 'var(--c-muted)',
                    }}
                  >
                    Last 30 Days
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="text-center py-16 rounded-2xl border space-y-2 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--c-gold)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Loading merchant dashboard metrics...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="rounded-2xl p-5 text-xs space-y-2" style={{ background: 'var(--c-status-red-bg)', border: '1px solid var(--c-border)', color: 'var(--c-status-red-text)' }}>
                  <p className="font-bold text-sm font-display">Dashboard Data Alert</p>
                  <p>{error}</p>
                  <button
                    onClick={fetchDashboard}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer font-display"
                    style={{ background: 'var(--c-status-red-text)', color: '#0a0908' }}
                  >
                    Retry Loading
                  </button>
                </div>
              )}

              {/* Dashboard Content */}
              {!loading && dashboardData && (
                <div className="space-y-8">
                  {/* Financial Metrics Section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: 'var(--c-muted)' }}>
                      FINANCIAL METRICS
                    </h3>
                    <RevenueMetrics metrics={dashboardData.metrics} />
                  </div>

                  {viewState === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <RecoveryFunnel funnel={dashboardData.funnel} />
                      <CustomerResponseBreakdown breakdown={dashboardData.response_breakdown} />
                    </div>
                  )}

                  {viewState === 'analytics' && (
                    <PaymentFailureReasons reasons={dashboardData.failure_reasons} />
                  )}

                  {/* Store Catalog & Inventory Overview Section */}
                  {(dashboardData as any).inventory_summary && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest font-display" style={{ color: 'var(--c-muted)' }}>
                        STORE CATALOG & INVENTORY
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-5 border rounded-2xl overflow-hidden themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                        <div className="p-5 space-y-1" style={{ borderColor: 'var(--c-border-soft)', borderRightWidth: '1px', borderStyle: 'solid' }}>
                          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
                            {(dashboardData as any).inventory_summary.total_listed || 0}
                          </p>
                          <p className="text-xs font-medium font-display" style={{ color: 'var(--c-muted)' }}>
                            Total Products
                          </p>
                        </div>

                        <div className="p-5 space-y-1" style={{ borderColor: 'var(--c-border-soft)', borderRightWidth: '1px', borderStyle: 'solid' }}>
                          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
                            {(dashboardData as any).inventory_summary.total_units_in_stock || 0}
                          </p>
                          <p className="text-xs font-medium font-display" style={{ color: 'var(--c-muted)' }}>
                            In Stock
                          </p>
                        </div>

                        <div className="p-5 space-y-1" style={{ borderColor: 'var(--c-border-soft)', borderRightWidth: '1px', borderStyle: 'solid' }}>
                          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-red-text)' }}>
                            {(dashboardData as any).inventory_summary.out_of_stock_count || 0}
                          </p>
                          <p className="text-xs font-medium font-display" style={{ color: 'var(--c-muted)' }}>
                            Out of Stock
                          </p>
                        </div>

                        <div className="p-5 space-y-1" style={{ borderColor: 'var(--c-border-soft)', borderRightWidth: '1px', borderStyle: 'solid' }}>
                          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
                            {(dashboardData as any).inventory_summary.total_sold || 0}
                          </p>
                          <p className="text-xs font-medium font-display" style={{ color: 'var(--c-muted)' }}>
                            Total Sold
                          </p>
                        </div>

                        <div className="p-5 space-y-1">
                          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
                            {(dashboardData as any).inventory_summary.reserved || 0}
                          </p>
                          <p className="text-xs font-medium font-display" style={{ color: 'var(--c-muted)' }}>
                            Reserved
                          </p>
                        </div>
                      </div>

                      {/* Products Summary Table */}
                      <div className="overflow-x-auto rounded-2xl border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                        <table className="w-full text-left text-xs font-sans">
                          <thead className="border-b font-bold uppercase text-[10px] tracking-wider font-display" style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
                            <tr>
                              <th className="py-3.5 px-5">PRODUCT</th>
                              <th className="py-3.5 px-5">CATEGORY</th>
                              <th className="py-3.5 px-5">PRICE</th>
                              <th className="py-3.5 px-5">AVAILABLE</th>
                              <th className="py-3.5 px-5">SOLD</th>
                            </tr>
                          </thead>
                          <tbody className="font-medium">
                            {((dashboardData as any).inventory_summary.products || []).map(
                              (item: any) => {
                                const available =
                                  item.available ??
                                  Math.max(
                                    0,
                                    (item.quantity_on_hand || 0) - (item.reserved || 0)
                                  );

                                return (
                                  <tr key={item.id} className="border-b last:border-b-0 transition" style={{ borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                                    <td className="py-4 px-5 font-bold font-display">
                                      {item.name}
                                    </td>
                                    <td className="py-4 px-5" style={{ color: 'var(--c-muted)' }}>
                                      {item.category || 'General'}
                                    </td>
                                    <td className="py-4 px-5 font-bold font-display" style={{ color: 'var(--c-text)' }}>
                                      ₹{(item.price_cents / 100).toFixed(2)}
                                    </td>
                                    <td className="py-4 px-5 font-bold font-display" style={{ color: 'var(--c-status-green-text)' }}>
                                      {available}
                                    </td>
                                    <td className="py-4 px-5 font-bold font-display" style={{ color: 'var(--c-text)' }}>
                                      {item.units_sold ?? 0}
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
