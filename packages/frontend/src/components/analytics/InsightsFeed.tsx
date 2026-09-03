/**
 * InsightsFeed Component
 * Displays AI-generated merchant insights matching reference screenshots 7 & 8
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
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'recovery', label: 'Recovery' },
    { id: 'abandoned', label: 'Abandoned' },
    { id: 'payment', label: 'Payment' },
  ];

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getApiUrl(`/merchant/insights?limit=50&offset=0`), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('AI insights are temporarily unavailable');
      }

      const data = await response.json();
      const rawInsights: MerchantInsight[] = data.insights || [];
      const seen = new Set<string>();
      const uniqueInsights = rawInsights.filter((item) => {
        const key = `${item.type}-${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

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

      await fetchInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh AI insights');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredInsights = insights.filter((item) => {
    if (activeCategory === 'all') return true;
    const typeStr = item.type.toLowerCase();
    if (activeCategory === 'recovery') return typeStr.includes('recovery');
    if (activeCategory === 'abandoned') return typeStr.includes('abandoned') || typeStr.includes('cart');
    if (activeCategory === 'payment') return typeStr.includes('payment') || typeStr.includes('failure');
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Section */}
      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
            AI POWERED
          </span>
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-0.5" style={{ color: 'var(--c-text)' }}>
            AI Merchant Insights.
          </h2>
          <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
            Autonomous business optimization and revenue recovery recommendations.
          </p>
        </div>

        {/* Filter Pills Header */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-display">
          <button
            onClick={handleRefreshInsights}
            disabled={refreshing || loading}
            className="px-3.5 py-1.5 rounded-full border font-bold transition cursor-pointer"
            style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Insights'}
          </button>

          <span className="text-xs font-medium ml-2" style={{ color: 'var(--c-muted)' }}>Filter by Category:</span>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-4 py-1.5 rounded-full font-bold transition cursor-pointer"
              style={{
                background: activeCategory === cat.id ? 'var(--c-gold)' : 'var(--c-surface2)',
                color: activeCategory === cat.id ? '#0a0908' : 'var(--c-muted)',
                border: activeCategory === cat.id ? 'none' : '1px solid var(--c-border-soft)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16 rounded-2xl border space-y-2 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--c-gold)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Analyzing store data & generating AI insights...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl p-6 text-center border" style={{ background: 'var(--c-status-amber-bg)', borderColor: 'var(--c-border)', color: 'var(--c-status-amber-text)' }}>
          <p className="font-bold text-sm mb-1 font-display">AI insights temporarily unavailable</p>
          <p className="text-xs mb-4">{error}</p>
          <button
            onClick={fetchInsights}
            className="px-4 py-2 rounded-xl text-xs font-bold font-display transition cursor-pointer"
            style={{ background: 'var(--c-gold)', color: '#0a0908' }}
          >
            Retry Generation
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredInsights.length === 0 && (
        <div className="rounded-2xl p-12 text-center border space-y-1 themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
          <p className="font-bold text-lg font-display" style={{ color: 'var(--c-text)' }}>No AI insights available</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>As customer transactions and recovery events process, AI recommendations will automatically generate here.</p>
        </div>
      )}

      {/* Insights Cards Feed */}
      {!loading && filteredInsights.length > 0 && (
        <div className="space-y-6">
          {filteredInsights.map((insight) => {
            const rec = insight.insights && insight.insights.length > 0 ? insight.insights[0] : null;

            return (
              <div
                key={insight.id}
                className="rounded-2xl border p-6 space-y-6 themed font-sans"
                style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
              >
                {/* Card Top Row */}
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)' }}>
                        {insight.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
                        {formatDate(insight.created_at)}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold font-display tracking-tight" style={{ color: 'var(--c-text)' }}>
                      {insight.title}
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                      {insight.summary}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-extrabold font-display block" style={{ color: 'var(--c-text)' }}>
                      {insight.confidence_percent}%
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--c-muted)' }}>
                      confidence
                    </span>
                  </div>
                </div>

                {/* Relevant Business Data Section */}
                {insight.data_summary && Object.keys(insight.data_summary).length > 0 && (
                  <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--c-border-soft)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-muted)' }}>
                      RELEVANT BUSINESS DATA
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {Object.entries(insight.data_summary)
                        .slice(0, 4)
                        .map(([key, value]) => {
                          const cleanKey = key.replace(/_rupees|_cents/g, '').replace(/_/g, ' ');
                          return (
                            <div key={key} className="space-y-0.5">
                              <p className="text-xs font-medium capitalize" style={{ color: 'var(--c-muted)' }}>
                                {cleanKey}
                              </p>
                              <p className="text-sm font-bold font-display" style={{ color: 'var(--c-text)' }}>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Actionable Recommendation Section */}
                {rec && (
                  <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--c-border-soft)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-muted)' }}>
                      ACTIONABLE RECOMMENDATION
                    </span>

                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div className="space-y-1">
                        <h4 className="text-base font-bold font-display" style={{ color: 'var(--c-text)' }}>
                          {rec.title}
                        </h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                          {rec.description}
                        </p>
                      </div>

                      {rec.priority && (
                        <span
                          className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-display shrink-0"
                          style={{
                            background: rec.priority === 'high' ? 'var(--c-status-red-bg)' : 'var(--c-status-amber-bg)',
                            color: rec.priority === 'high' ? 'var(--c-status-red-text)' : 'var(--c-status-amber-text)',
                            border: '1px solid var(--c-border-soft)',
                          }}
                        >
                          {rec.priority} PRIORITY
                        </span>
                      )}
                    </div>

                    {/* Bottom Reasoning & Next Step Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-muted)' }}>
                          REASONING
                        </span>
                        <p style={{ color: 'var(--c-muted)' }}>
                          {rec.reasoning}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-display" style={{ color: 'var(--c-muted)' }}>
                          NEXT STEP
                        </span>
                        <p className="font-medium" style={{ color: 'var(--c-status-green-text)' }}>
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
