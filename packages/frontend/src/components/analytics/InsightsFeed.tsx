/**
 * InsightsFeed Component (M8)
 * Displays daily AI-generated merchant insights with clean state replacement and error controls.
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { formatRupees, formatCentsToRupees } from '../../utils/currency';

interface InsightRecommendation {
  title: string;
  description: string;
  reasoning: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence_percent: number;
  data_sources: string[];
  limitations?: string;
}

interface MerchantInsight {
  id: string;
  type: string;
  title: string;
  summary: string;
  insights: InsightRecommendation[];
  data_summary: Record<string, unknown>;
  confidence_percent: number;
  guard_rails_applied?: string[];
  created_at: string;
  is_read: boolean;
}

export default function InsightsFeed() {
  const [insights, setInsights] = useState<MerchantInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>('');

  const insightTypes = [
    { value: 'payment_failure_patterns', label: 'Payment Failures' },
    { value: 'abandoned_cart_patterns', label: 'Abandoned Carts' },
    { value: 'recovery_success_rates', label: 'Recovery Performance' },
    { value: 'product_bundles', label: 'Product Bundles' },
    { value: 'discount_strategy', label: 'Discount Strategy' },
    { value: 'inventory_optimization', label: 'Inventory Optimization' },
    { value: 'recovery_targeting', label: 'Recovery Targeting' },
  ];

  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (insightTypeFilter) {
        query.append('type', insightTypeFilter);
      }
      query.append('limit', '50');
      query.append('offset', '0');

      const response = await fetch(getApiUrl(`/merchant/insights?${query}`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('AI insights are temporarily unavailable');
      }

      const data = await response.json();
      
      // Deduplicate insights cleanly by ID / Title
      const rawInsights: MerchantInsight[] = data.insights || [];
      const seen = new Set<string>();
      const uniqueInsights = rawInsights.filter((item) => {
        const key = `${item.type}-${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // ALWAYS replace insights state rather than appending
      setInsights(uniqueInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI insights are temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshInsights = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(getApiUrl('/merchant/insights/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate insights');
      }

      // Re-fetch after recalculating to respect active category filter
      await fetchInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh AI insights');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [insightTypeFilter]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'medium':
        return 'bg-amber-50 border-amber-300 text-amber-900';
      case 'low':
        return 'bg-emerald-50 border-emerald-300 text-emerald-900';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-900';
    }
  };

  const getInsightTypeLabel = (type: string) => {
    const typeObj = insightTypes.find((t) => t.value === type);
    return typeObj ? typeObj.label : type;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🤖</span> AI Merchant Insights
          </h2>
          <p className="text-xs text-gray-500 mt-1">Autonomous business optimization and revenue recovery recommendations</p>
        </div>
        <button
          onClick={handleRefreshInsights}
          disabled={refreshing || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {refreshing ? (
            <>
              <span className="animate-spin">🔄</span> Recalculating Analytics...
            </>
          ) : (
            <>🔄 Refresh Insights</>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-700">Filter by Category:</label>
        <select
          value={insightTypeFilter}
          onChange={(e) => setInsightTypeFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium bg-white"
        >
          <option value="">All Categories</option>
          {insightTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 font-medium">Analyzing merchant data and generating AI insights...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-center">
          <p className="text-amber-900 font-bold mb-1">AI insights are temporarily unavailable</p>
          <p className="text-xs text-amber-700 mb-4">{error}</p>
          <button
            onClick={fetchInsights}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
          >
            Retry Generation
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && insights.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-gray-200">
          <p className="text-gray-700 font-bold text-lg mb-1">No AI insights are available for this period</p>
          <p className="text-xs text-gray-500">As customer transactions and recovery events process, AI recommendations will automatically generate here.</p>
        </div>
      )}

      {/* Insights List */}
      {!loading && insights.length > 0 && (
        <div className="space-y-6">
          {insights.map((insight) => (
            <div key={insight.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{getInsightTypeLabel(insight.type).split(' ')[0]}</span>
                    <h3 className="text-lg font-bold text-gray-900">{insight.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{formatDate(insight.created_at)}</p>
                </div>
                <span className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-bold text-blue-800">
                  {insight.confidence_percent}% confidence
                </span>
              </div>

              {/* Summary */}
              <p className="text-xs text-gray-700 mb-4 leading-relaxed">{insight.summary}</p>

              {/* Data Summary */}
              {insight.data_summary && Object.keys(insight.data_summary).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">📊 Relevant Business Data Metrics:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(insight.data_summary)
                      .slice(0, 4)
                      .map(([key, value]) => {
                        const isMoney = typeof value === 'number' && (key.includes('rupees') || key.includes('revenue') || key.includes('amount') || key.includes('value') || key.includes('cents')) && !key.includes('count') && !key.includes('rate') && !key.includes('percent');
                        let formattedVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        if (typeof value === 'number') {
                          if (key.includes('cents')) {
                            formattedVal = formatCentsToRupees(value);
                          } else if (isMoney) {
                            formattedVal = formatRupees(value);
                          }
                        }
                        const cleanKey = key.replace(/_rupees|_cents/g, '').replace(/_/g, ' ');
                        return (
                          <div key={key} className="text-xs text-gray-600">
                            <span className="font-semibold text-gray-800 capitalize">{cleanKey}:</span>{' '}
                            {formattedVal}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {insight.insights && insight.insights.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-700">🎯 Actionable Recommendations:</p>
                  {insight.insights.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`border-l-4 p-4 rounded-r-lg text-xs ${getPriorityColor(rec.priority)}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm">{rec.title}</p>
                          <p className="text-gray-700">{rec.description}</p>
                          <p className="text-[11px] text-gray-500 italic mt-1">Reasoning: {rec.reasoning}</p>
                          <p className="font-bold text-blue-900 mt-2">Next Step: {rec.action}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-white bg-opacity-70 rounded text-[10px] font-bold uppercase">
                          {rec.priority} priority
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
