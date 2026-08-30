import React from 'react';

export interface TimelineEvent {
  id: string;
  order_id: string;
  event_type: 'ORDER_CONFIRMED' | 'ORDER_DISPATCHED' | 'ORDER_DELIVERED' | string;
  actor_role: 'customer' | 'merchant' | 'system' | 'admin';
  actor_id?: string;
  description?: string;
  created_at: string;
}

interface OrderTimelineViewProps {
  timeline: TimelineEvent[];
  currentStatus: string;
}

export const OrderTimelineView: React.FC<OrderTimelineViewProps> = ({ timeline, currentStatus }) => {
  const normStatus = (currentStatus || 'pending').toLowerCase();

  const steps = [
    { key: 'confirmed', label: 'Order Confirmed', event: 'ORDER_CONFIRMED' },
    { key: 'dispatched', label: 'Dispatched', event: 'ORDER_DISPATCHED' },
    { key: 'delivered', label: 'Delivered', event: 'ORDER_DELIVERED' },
  ];

  const getStepState = (stepKey: string) => {
    if (normStatus === 'delivered') return 'completed';
    if (normStatus === 'dispatched' || normStatus === 'shipped') {
      if (stepKey === 'confirmed' || stepKey === 'dispatched') return 'completed';
      return 'upcoming';
    }
    if (normStatus === 'confirmed') {
      if (stepKey === 'confirmed') return 'completed';
      return 'upcoming';
    }
    return 'upcoming';
  };

  const getEventForStep = (stepEvent: string) => {
    return (timeline || []).find((e) => e.event_type === stepEvent);
  };

  return (
    <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
          Fulfillment Status Timeline
        </h4>
        <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
          Status: {currentStatus}
        </span>
      </div>

      {/* Progress Bar / Steps */}
      <div className="relative flex items-center justify-between max-w-md mx-auto py-2">
        {/* Connecting Line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-gray-200 -z-0">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{
              width:
                normStatus === 'delivered'
                  ? '100%'
                  : normStatus === 'dispatched' || normStatus === 'shipped'
                  ? '50%'
                  : normStatus === 'confirmed'
                  ? '0%'
                  : '0%',
            }}
          />
        </div>

        {steps.map((step) => {
          const state = getStepState(step.key);
          const ev = getEventForStep(step.event);
          const isCompleted = state === 'completed';

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs transition-all shadow-sm ${
                  isCompleted
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                    : 'bg-white border-2 border-gray-300 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>○</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-bold text-center ${
                  isCompleted ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {ev && (
                <span className="text-[10px] text-gray-500 mt-0.5 font-medium">
                  {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* History Log */}
      {timeline && timeline.length > 0 && (
        <div className="pt-3 border-t border-gray-200/80 space-y-2.5">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Activity Log</h5>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {timeline.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-2.5 bg-white border border-gray-200 rounded-lg text-xs shadow-2xs"
              >
                <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{item.event_type.replace(/_/g, ' ')}</span>
                    <span className="px-1.5 py-0.2 text-[9px] uppercase font-mono rounded bg-gray-100 text-gray-600 border border-gray-200">
                      {item.actor_role}
                    </span>
                  </div>
                  {item.description && <p className="text-gray-600 text-[11px]">{item.description}</p>}
                </div>
                <span className="text-gray-400 shrink-0 font-mono text-[10px]">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
