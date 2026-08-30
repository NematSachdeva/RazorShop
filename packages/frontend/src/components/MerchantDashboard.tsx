/**
 * M7 Merchant Dashboard
 * 
 * Main merchant analytics page displaying:
 * - Revenue metrics (total, at-risk, recovered)
 * - Recovery funnel (status breakdown)
 * - Customer response breakdown
 * - Payment failure reasons
 * - Revenue timeline
 * - Recovery cases list
 */

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

type ViewState = 'dashboard' | 'products' | 'orders' | 'recovery-cases' | 'recovery-case-detail' | 'insights' | 'config';

export default function MerchantDashboard() {
  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeRangeDays, setActiveRangeDays] = useState<number | 'prev_month' | 'custom'>(5);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleRangeChange = (range: number | 'prev_month' | 'custom', customStart?: string, customEnd?: string) => {
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

  // Fetch dashboard data
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
        throw new Error('Failed to load dashboard data');
      }

      const data: DashboardData = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [startDate, endDate]);

  const handleViewProducts = () => {
    setViewState('products');
  };

  const handleViewRecoveryCases = () => {
    setSelectedCaseId(null);
    setViewState('recovery-cases');
  };

  const handleViewCaseDetail = (caseId: string) => {
    setSelectedCaseId(caseId);
    setViewState('recovery-case-detail');
  };

  const handleViewInsights = () => {
    setViewState('insights');
  };

  const handleViewConfig = () => {
    setViewState('config');
  };

  const renderHeaderNav = () => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
      <div className="mx-auto max-w-7xl px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Merchant Portal</h1>
        
        <nav className="flex items-center gap-2">
          <button
            onClick={() => setViewState('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            📊 Analytics
          </button>

          <button
            onClick={() => setViewState('orders')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'orders'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            🚚 Orders & Fulfillment
          </button>

          <button
            onClick={() => setViewState('products')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'products'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            📦 Products & Stock
          </button>

          <button
            onClick={() => setViewState('recovery-cases')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'recovery-cases' || viewState === 'recovery-case-detail'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            📋 Recovery Cases
          </button>

          <button
            onClick={() => setViewState('insights')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'insights'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            🤖 Insights
          </button>

          <button
            onClick={() => setViewState('config')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              viewState === 'config'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            ⚙️ Config
          </button>
        </nav>
      </div>
    </header>
  );

  if (viewState === 'orders') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <MerchantOrdersTab />
        </main>
      </div>
    );
  }

  if (viewState === 'products') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <MerchantProducts />
        </main>
      </div>
    );
  }

  if (viewState === 'recovery-cases') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <RecoveryCasesList onCaseSelected={handleViewCaseDetail} />
        </main>
      </div>
    );
  }

  if (viewState === 'recovery-case-detail' && selectedCaseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <RecoveryCaseDetail caseId={selectedCaseId} />
        </main>
      </div>
    );
  }

  if (viewState === 'insights') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <InsightsFeed />
        </main>
      </div>
    );
  }

  if (viewState === 'config') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeaderNav()}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <MerchantConfigUI />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeaderNav()}

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Date Range Selector */}
        <div className="bg-white p-4 rounded shadow mb-8">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-8">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchDashboard}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && dashboardData && (
          <>
            {/* Revenue Metrics */}
            <RevenueMetrics metrics={dashboardData.metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Recovery Funnel */}
              <RecoveryFunnel funnel={dashboardData.funnel} />

              {/* Customer Response Breakdown */}
              <CustomerResponseBreakdown breakdown={dashboardData.response_breakdown} />
            </div>

            {/* Payment Failure Reasons */}
            <PaymentFailureReasons reasons={dashboardData.failure_reasons} />

            {/* Authoritative Store Catalog & Inventory Summary Section */}
            {(dashboardData as any).inventory_summary && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span>📦</span> Store Catalog & Inventory
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Authoritative PostgreSQL inventory levels and sales metrics</p>
                  </div>
                  <button
                    onClick={handleViewProducts}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    View All Products & Stock →
                  </button>
                </div>

                {/* Authoritative Catalog KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                    <p className="text-[11px] text-blue-800 font-bold">Products Listed</p>
                    <p className="text-xl font-black text-blue-950 mt-0.5">
                      {(dashboardData as any).inventory_summary.total_listed || 0}
                    </p>
                  </div>

                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                    <p className="text-[11px] text-emerald-800 font-bold">Total Stock Units</p>
                    <p className="text-xl font-black text-emerald-950 mt-0.5">
                      {(dashboardData as any).inventory_summary.total_units_in_stock || 0}
                    </p>
                  </div>

                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <p className="text-[11px] text-amber-800 font-bold">Low Stock Items</p>
                    <p className="text-xl font-black text-amber-950 mt-0.5">
                      {(dashboardData as any).inventory_summary.low_stock_count || 0}
                    </p>
                  </div>

                  <div className="bg-red-50/70 p-3.5 rounded-xl border border-red-200">
                    <p className="text-[11px] text-red-800 font-bold">Out of Stock</p>
                    <p className="text-xl font-black text-red-950 mt-0.5">
                      {(dashboardData as any).inventory_summary.out_of_stock_count || 0}
                    </p>
                  </div>

                  <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 col-span-2 md:col-span-1">
                    <p className="text-[11px] text-purple-800 font-bold">Total Units Sold</p>
                    <p className="text-xl font-black text-purple-950 mt-0.5">
                      {(dashboardData as any).inventory_summary.total_sold || 0}
                    </p>
                  </div>
                </div>

                {/* Compact Products Summary Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                      <tr>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                        <th className="py-2.5 px-4 text-center">Available Stock</th>
                        <th className="py-2.5 px-4 text-right">Units Sold</th>
                        <th className="py-2.5 px-4 text-center">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {((dashboardData as any).inventory_summary.products || []).map((item: any) => {
                        const available = item.available ?? Math.max(0, (item.quantity_on_hand || 0) - (item.reserved || 0));
                        const isLow = available > 0 && available <= 5;
                        const isOut = available === 0;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-bold text-gray-900">{item.name}</td>
                            <td className="py-2.5 px-4">
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                                {item.category || 'General'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-blue-700">
                              ₹{(item.price_cents / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-gray-900">{available}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-green-700">{item.units_sold}</td>
                            <td className="py-2.5 px-4 text-center">
                              {isOut ? (
                                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                  Low Stock ({available})
                                </span>
                              ) : (
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                  In Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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

            {/* M7-M8 Navigation Section */}
            <div className="mt-8 space-y-4">
              {/* Quick Access Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded shadow border border-blue-200">
                  <h3 className="text-lg font-bold text-blue-900 mb-2">🤖 AI Insights</h3>
                  <p className="text-sm text-blue-700 mb-4">View daily AI-generated merchant insights and recommendations</p>
                  <button
                    onClick={handleViewInsights}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Insights
                  </button>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded shadow border border-green-200">
                  <h3 className="text-lg font-bold text-green-900 mb-2">⚙️ Configuration</h3>
                  <p className="text-sm text-green-700 mb-4">Manage AI features, guard rails, and recovery settings</p>
                  <button
                    onClick={handleViewConfig}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Manage Config
                  </button>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded shadow border border-purple-200">
                  <h3 className="text-lg font-bold text-purple-900 mb-2">📋 Recovery Cases</h3>
                  <p className="text-sm text-purple-700 mb-4">View and manage individual recovery cases</p>
                  <button
                    onClick={handleViewRecoveryCases}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    View Cases
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !error && !dashboardData && (
          <div className="bg-gray-100 rounded p-8 text-center">
            <p className="text-gray-600">No data available for the selected period</p>
          </div>
        )}
      </main>
    </div>
  );
}
