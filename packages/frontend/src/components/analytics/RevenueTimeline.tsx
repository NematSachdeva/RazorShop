/**
 * RevenueTimeline Component
 * Interactive Revenue & Recovery Analytics chart with range selection controls.
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

  // Calculate recovery rate for selected range
  const totalRecovered = timeline?.totals?.recovered_amount_cents || 0;
  const totalRev = timeline?.totals?.revenue_cents || 0;
  const totalFailed = timeline?.totals?.failed_payments_count || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 space-y-6">
      {/* Header & Range Selector Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 Revenue & Recovery Timeline</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Reporting Period: {timeline.period?.start_date} to {timeline.period?.end_date}
          </p>
        </div>

        {/* Preset Range Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => onRangeChange(5)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 5 ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 5 Days
          </button>
          <button
            onClick={() => onRangeChange(10)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 10 ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 10 Days
          </button>
          <button
            onClick={() => onRangeChange(20)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 20 ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 20 Days
          </button>
          <button
            onClick={() => onRangeChange(30)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 30 ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => onRangeChange('prev_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 'prev_month' ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Previous Month
          </button>
          <button
            onClick={() => onRangeChange('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeRangeDays === 'custom' ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Custom Range Picker */}
      {activeRangeDays === 'custom' && (
        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="block text-gray-700 font-bold mb-1">Start Date</label>
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-bold mb-1">End Date</label>
            <input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
            />
          </div>
          <div className="self-end">
            <button
              onClick={handleApplyCustom}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Apply Filter
            </button>
          </div>
          {customError && <p className="w-full text-red-600 font-bold">{customError}</p>}
        </div>
      )}

      {/* Summary Metric Cards for Selected Range */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
          <p className="text-xs text-blue-800 font-bold mb-1">Period Total Revenue</p>
          <p className="text-2xl font-black text-blue-950">{formatPrice(totalRev)}</p>
          <p className="text-[10px] text-blue-600 font-medium mt-1">{timeline?.totals?.orders_count || 0} Confirmed Orders</p>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
          <p className="text-xs text-amber-800 font-bold mb-1">Period Total Orders</p>
          <p className="text-2xl font-black text-amber-950">{timeline?.totals?.orders_count || 0}</p>
          <p className="text-[10px] text-amber-600 font-medium mt-1">Confirmed & Processing</p>
        </div>

        <div className="bg-red-50/70 p-4 rounded-xl border border-red-200">
          <p className="text-xs text-red-800 font-bold mb-1">Failed Payments</p>
          <p className="text-2xl font-black text-red-950">{totalFailed}</p>
          <p className="text-[10px] text-red-600 font-medium mt-1">Payment exceptions in range</p>
        </div>

        <div className="bg-green-50/70 p-4 rounded-xl border border-green-200">
          <p className="text-xs text-green-800 font-bold mb-1">Total Recovered Revenue</p>
          <p className="text-2xl font-black text-green-950">{formatPrice(totalRecovered)}</p>
          <p className="text-[10px] text-green-600 font-medium mt-1">Recovered from failure flows</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <p className="text-gray-500 font-medium">No activity recorded for the selected date range</p>
        </div>
      ) : (
        <>
          {/* Interactive Chart */}
          <div className="bg-gray-50/80 rounded-xl p-6 border border-gray-200 relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-6 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                  <span className="text-gray-700">Total Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span className="text-gray-700">Recovered Revenue</span>
                </div>
              </div>

              {hoveredPoint && (
                <div className="bg-white px-3 py-1 rounded-lg border border-gray-300 text-xs shadow-sm font-medium">
                  <span className="font-bold">{formatDate(hoveredPoint.date)}: </span>
                  <span className="text-blue-600 font-bold">{formatPrice(hoveredPoint.revenue_cents)}</span> |{' '}
                  <span className="text-green-600 font-bold">Recovered: {formatPrice(hoveredPoint.recovered_amount_cents)}</span>
                </div>
              )}
            </div>

            {/* Visual Bar/Line Representation */}
            <div className="h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-gray-300">
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
                        className="w-1/2 bg-blue-500 hover:bg-blue-600 rounded-t transition-all group-hover:scale-105"
                        style={{ height: `${revHeight}%` }}
                      />
                      {/* Recovered Revenue Bar */}
                      <div
                        className="w-1/2 bg-green-500 hover:bg-green-600 rounded-t transition-all group-hover:scale-105"
                        style={{ height: `${recHeight}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Readable X-Axis Labels */}
            <div className="flex justify-between text-[11px] text-gray-500 font-semibold pt-2 px-2">
              <span>{formatDate(data[0].date)}</span>
              {data.length > 4 && <span>{formatDate(data[Math.floor(data.length / 2)].date)}</span>}
              <span>{formatDate(data[data.length - 1].date)}</span>
            </div>
          </div>

          {/* Compact Detailed Table */}
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Revenue</th>
                  <th className="py-2.5 px-4 text-right">Orders</th>
                  <th className="py-2.5 px-4 text-right">Failed Payments</th>
                  <th className="py-2.5 px-4 text-right">Recovered Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((point, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 font-medium">
                    <td className="py-2.5 px-4 text-gray-900 font-bold">{formatDate(point.date)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-900">{formatPrice(point.revenue_cents)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-700">{point.orders_count}</td>
                    <td className="py-2.5 px-4 text-right text-red-600 font-bold">{point.failed_payments_count}</td>
                    <td className="py-2.5 px-4 text-right text-green-600 font-bold">
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
