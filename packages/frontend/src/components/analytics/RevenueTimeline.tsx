/**
 * RevenueTimeline Component
 * Interactive Revenue & Recovery Analytics chart with range selection controls.
 * Redesigned using Figma theme tokens.
 */

import { useState } from 'react';

export interface DailyDataPoint {
  date: string;
  revenue_cents: number;
  orders_count: number;
  failed_payments_count: number;
  recovered_amount_cents: number;
}

export interface TimelineData {
  data: DailyDataPoint[];
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
}

interface RevenueTimelineProps {
  timeline: TimelineData;
  activeRangeDays: number | 'prev_month' | 'custom';
  onRangeChange: (range: number | 'prev_month' | 'custom', customStart?: string, customEnd?: string) => void;
  customStartDate?: string;
  customEndDate?: string;
}

export default function RevenueTimeline({
  timeline,
  activeRangeDays,
  onRangeChange,
  customStartDate = '',
  customEndDate = '',
}: RevenueTimelineProps) {
  const [hoveredPoint, setHoveredPoint] = useState<DailyDataPoint | null>(null);
  const [startDateInput, setStartDateInput] = useState(customStartDate);
  const [endDateInput, setEndDateInput] = useState(customEndDate);
  const [customError, setCustomError] = useState<string | null>(null);

  const formatPrice = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const data = timeline?.data || [];
  const maxRevenue = Math.max(...data.map((d) => d.revenue_cents), 1);
  const maxRecovered = Math.max(...data.map((d) => d.recovered_amount_cents), 1);
  const maxBarVal = Math.max(maxRevenue, maxRecovered, 100);

  const handleApplyCustom = () => {
    setCustomError(null);
    if (!startDateInput || !endDateInput) {
      setCustomError('Please select both start and end dates.');
      return;
    }
    if (new Date(startDateInput) > new Date(endDateInput)) {
      setCustomError('Start date cannot be after end date.');
      return;
    }
    onRangeChange('custom', startDateInput, endDateInput);
  };

  const totalRecovered = timeline?.totals?.recovered_amount_cents || 0;
  const totalRev = timeline?.totals?.revenue_cents || 0;
  const totalFailed = timeline?.totals?.failed_payments_count || 0;

  return (
    <div
      className="rounded-2xl border p-6 mb-8 space-y-6 themed"
      style={{
        background: 'var(--c-surface)',
        borderColor: 'var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      {/* Header & Range Selector Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display" style={{ color: 'var(--c-text)' }}>
            📊 Revenue & Recovery Timeline
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Reporting Period: {timeline.period?.start_date} to {timeline.period?.end_date}
          </p>
        </div>

        {/* Preset Range Buttons */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl" style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border-soft)' }}>
          {[
            { label: 'Last 5 Days', value: 5 },
            { label: 'Last 10 Days', value: 10 },
            { label: 'Last 20 Days', value: 20 },
            { label: 'Last 30 Days', value: 30 },
            { label: 'Previous Month', value: 'prev_month' as const },
            { label: 'Custom Range', value: 'custom' as const },
          ].map((btn) => (
            <button
              key={String(btn.value)}
              onClick={() => onRangeChange(btn.value as any)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-display"
              style={{
                background: activeRangeDays === btn.value ? 'var(--c-gold)' : 'transparent',
                color: activeRangeDays === btn.value ? '#0a0908' : 'var(--c-muted)',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Range Picker */}
      {activeRangeDays === 'custom' && (
        <div className="p-4 rounded-xl border flex flex-wrap items-center gap-3 text-xs" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <div>
            <label className="block font-bold mb-1" style={{ color: 'var(--c-muted)' }}>Start Date</label>
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="px-3 py-1.5 rounded-lg border font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
            />
          </div>
          <div>
            <label className="block font-bold mb-1" style={{ color: 'var(--c-muted)' }}>End Date</label>
            <input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="px-3 py-1.5 rounded-lg border font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
            />
          </div>
          <div className="self-end">
            <button
              onClick={handleApplyCustom}
              className="px-4 py-2 rounded-lg font-bold transition cursor-pointer font-display"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              Apply Filter
            </button>
          </div>
          {customError && <p className="w-full font-bold" style={{ color: 'var(--c-status-red-text)' }}>{customError}</p>}
        </div>
      )}

      {/* Summary Metric Cards for Selected Range */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="text-xs font-bold mb-1 uppercase font-display" style={{ color: 'var(--c-muted)' }}>Period Revenue</p>
          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-blue-text)' }}>{formatPrice(totalRev)}</p>
          <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--c-muted)' }}>{timeline?.totals?.orders_count || 0} Confirmed Orders</p>
        </div>

        <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="text-xs font-bold mb-1 uppercase font-display" style={{ color: 'var(--c-muted)' }}>Period Orders</p>
          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-gold)' }}>{timeline?.totals?.orders_count || 0}</p>
          <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--c-muted)' }}>Confirmed & Processing</p>
        </div>

        <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="text-xs font-bold mb-1 uppercase font-display" style={{ color: 'var(--c-muted)' }}>Failed Payments</p>
          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-red-text)' }}>{totalFailed}</p>
          <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--c-muted)' }}>Payment exceptions in range</p>
        </div>

        <div className="p-4 rounded-xl border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="text-xs font-bold mb-1 uppercase font-display" style={{ color: 'var(--c-muted)' }}>Recovered Revenue</p>
          <p className="text-2xl font-bold font-display" style={{ color: 'var(--c-status-green-text)' }}>{formatPrice(totalRecovered)}</p>
          <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--c-muted)' }}>Recovered from failure flows</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl p-8 text-center border" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
          <p className="font-medium" style={{ color: 'var(--c-muted)' }}>No activity recorded for the selected date range</p>
        </div>
      ) : (
        <>
          {/* Interactive Chart */}
          <div className="rounded-xl p-6 border relative" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-6 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-status-blue-text)' }} />
                  <span style={{ color: 'var(--c-text-dim)' }}>Total Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-status-green-text)' }} />
                  <span style={{ color: 'var(--c-text-dim)' }}>Recovered Revenue</span>
                </div>
              </div>

              {hoveredPoint && (
                <div className="px-3 py-1 rounded-lg border text-xs shadow-sm font-medium" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
                  <span className="font-bold">{formatDate(hoveredPoint.date)}: </span>
                  <span className="font-bold" style={{ color: 'var(--c-status-blue-text)' }}>{formatPrice(hoveredPoint.revenue_cents)}</span> |{' '}
                  <span className="font-bold" style={{ color: 'var(--c-status-green-text)' }}>Recovered: {formatPrice(hoveredPoint.recovered_amount_cents)}</span>
                </div>
              )}
            </div>

            {/* Visual Bar Representation */}
            <div className="h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
              {data.map((point, idx) => {
                const revHeight = Math.max((point.revenue_cents / maxBarVal) * 100, point.revenue_cents > 0 ? 8 : 2);
                const recHeight = Math.max((point.recovered_amount_cents / maxBarVal) * 100, point.recovered_amount_cents > 0 ? 8 : 2);

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {/* Total Revenue Bar */}
                      <div
                        className="w-1/2 rounded-t transition-all group-hover:scale-105"
                        style={{ height: `${revHeight}%`, background: 'var(--c-status-blue-text)', opacity: 0.8 }}
                      />
                      {/* Recovered Revenue Bar */}
                      <div
                        className="w-1/2 rounded-t transition-all group-hover:scale-105"
                        style={{ height: `${recHeight}%`, background: 'var(--c-status-green-text)', opacity: 0.8 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Readable X-Axis Labels */}
            <div className="flex justify-between text-[11px] font-semibold pt-2 px-2" style={{ color: 'var(--c-muted)' }}>
              <span>{formatDate(data[0].date)}</span>
              {data.length > 4 && <span>{formatDate(data[Math.floor(data.length / 2)].date)}</span>}
              <span>{formatDate(data[data.length - 1].date)}</span>
            </div>
          </div>

          {/* Compact Detailed Table */}
          <div className="overflow-x-auto rounded-xl border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
            <table className="w-full text-xs text-left font-sans">
              <thead className="border-b font-bold font-display uppercase tracking-wider text-[10px]" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-muted)' }}>
                <tr>
                  <th className="py-3 px-5">DATE</th>
                  <th className="py-3 px-5 text-right">REVENUE</th>
                  <th className="py-3 px-5 text-right">ORDERS</th>
                  <th className="py-3 px-5 text-right">FAILED</th>
                  <th className="py-3 px-5 text-right">RECOVERED</th>
                </tr>
              </thead>
              <tbody>
                {data.map((point, idx) => (
                  <tr key={idx} className="font-medium border-b last:border-b-0 transition" style={{ borderColor: 'var(--c-border-soft)' }}>
                    <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--c-text)' }}>{formatDate(point.date)}</td>
                    <td className="py-2.5 px-4 text-right" style={{ color: 'var(--c-text)' }}>{formatPrice(point.revenue_cents)}</td>
                    <td className="py-2.5 px-4 text-right" style={{ color: 'var(--c-text-dim)' }}>{point.orders_count}</td>
                    <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--c-status-red-text)' }}>{point.failed_payments_count}</td>
                    <td className="py-2.5 px-4 text-right font-bold" style={{ color: 'var(--c-status-green-text)' }}>
                      {formatPrice(point.recovered_amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
