/**
 * InsightsFeed Component (M8)
 * Displays daily AI-generated merchant insights
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

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
    { value: 'payment_failure_patterns', label: '💳 Payment Failures' },
    { value: 'abandoned_cart_patterns', label: '🛒 Abandoned Carts' },
    { value: 'recovery_success_rates', label: '📈 Recovery Performance' },
    { value: 'product_bundles', label: '📦 Product Bundles' },
    { value: 'discount_strategy', label: '💰 Discount Strategy' },
    { value: 'inventory_optimization', label: '📊 Inventory' },
    { value: 'recovery_targeting', label: '🎯 Recovery Targeting' },
  ];

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
        throw new Error('Failed to load insights');
      }

      const data = await response.json();
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [insightTypeFilter]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'low':
        return 'bg-green-100 border-green-300 text-green-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
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
    <div className="bg-white rounded shadow p-6 mb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🤖 AI Merchant Insights</h2>
        <button
          onClick={fetchInsights}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
        <select
          value={insightTypeFilter}
          onChange={(e) => setInsightTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded"
        >
          <option value="">All Types</option>
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
          <p className="text-gray-600">Loading insights...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchInsights}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && insights.length === 0 && (
        <div className="bg-gray-100 rounded p-8 text-center">
          <p className="text-gray-600">No insights available yet. Check back tomorrow!</p>
        </div>
      )}

      {/* Insights List */}
      {!loading && insights.length > 0 && (
        <div className="space-y-6">
          {insights.map((insight) => (
            <div key={insight.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
              {/* Insight Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getInsightTypeLabel(insight.type).split(' ')[0]}</span>
                    <h3 className="text-xl font-semibold text-gray-900">{insight.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{formatDate(insight.created_at)}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-blue-100 border border-blue-300 rounded text-sm font-semibold text-blue-900">
                    {insight.confidence_percent}% confidence
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-gray-700 mb-4">{insight.summary}</p>

              {/* Data Summary */}
              {Object.keys(insight.data_summary).length > 0 && (
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Key Data:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(insight.data_summary)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="text-sm text-gray-600">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {insight.insights.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Recommendations:</p>
                  <div className="space-y-2">
                    {insight.insights.map((rec, idx) => (
                      <div
                        key={idx}
                        className={`border-l-4 p-3 rounded ${getPriorityColor(rec.priority)}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold">{rec.title}</p>
                            <p className="text-sm mt-1">{rec.description}</p>
                            <p className="text-xs mt-2 italic">{rec.reasoning}</p>
                            <p className="text-sm font-semibold mt-2">{rec.action}</p>
                          </div>
                          <div className="text-right ml-4">
                            <span className="inline-block px-2 py-1 bg-white bg-opacity-50 rounded text-xs font-semibold">
                              {rec.confidence_percent}%
                            </span>
                          </div>
                        </div>
                        {rec.limitations && (
                          <p className="text-xs mt-2 opacity-75">⚠️ Limitations: {rec.limitations}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guard Rails Applied */}
              {insight.guard_rails_applied && insight.guard_rails_applied.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                  <p className="text-xs font-semibold text-blue-900 mb-1">🛡️ Guard Rails Applied:</p>
                  <div className="flex flex-wrap gap-1">
                    {insight.guard_rails_applied.map((rail, idx) => (
                      <span key={idx} className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded">
                        {rail}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && insights.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {insights.length} insights. Generated daily at 2:00 AM.
          </p>
        </div>
      )}
    </div>
  );
}
