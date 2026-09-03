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

  const isCancelled = normStatus === 'cancelled';
  const isRejected = normStatus === 'return_rejected';
  const isReturnFlow =
    normStatus.startsWith('return_') ||
    normStatus.startsWith('pickup_') ||
    normStatus.startsWith('order_picked_') ||
    normStatus === 'order_returned_to_seller' ||
    normStatus === 'refund_initiated';

  // Standard steps
  const standardSteps = [
    { key: 'confirmed', label: 'Confirmed', event: 'ORDER_CONFIRMED' },
    { key: 'dispatched', label: 'Dispatched', event: 'ORDER_DISPATCHED' },
    { key: 'delivered', label: 'Delivered', event: 'ORDER_DELIVERED' },
  ];

  // Full return steps
  const fullReturnSteps = [
    { key: 'return_requested', label: 'Return Requested', event: 'RETURN_REQUESTED' },
    { key: 'return_approved', label: 'Return Approved', event: 'RETURN_APPROVED' },
    { key: 'pickup_scheduled', label: 'Pickup Scheduled', event: 'PICKUP_SCHEDULED' },
    { key: 'order_picked_up', label: 'Picked Up', event: 'ORDER_PICKED_UP' },
    { key: 'return_in_transit', label: 'In Transit', event: 'RETURN_IN_TRANSIT' },
    { key: 'order_returned_to_seller', label: 'Returned to Seller', event: 'ORDER_RETURNED_TO_SELLER' },
    { key: 'refund_initiated', label: 'Refund Initiated', event: 'REFUND_INITIATED' },
  ];

  // Rejected return steps
  const rejectedReturnSteps = [
    { key: 'return_requested', label: 'Return Requested', event: 'RETURN_REQUESTED' },
    { key: 'return_rejected', label: 'Return Rejected', event: 'RETURN_REJECTED' },
  ];

  const getEventForStep = (stepEvent: string) => {
    return (timeline || []).find((e) => e.event_type === stepEvent);
  };

  const returnSequence = [
    'return_requested',
    'return_approved',
    'pickup_scheduled',
    'order_picked_up',
    'return_in_transit',
    'order_returned_to_seller',
    'refund_initiated',
  ];

  const currentReturnIndex = returnSequence.indexOf(normStatus);

  const getStepState = (stepKey: string) => {
    if (isCancelled) {
      if (stepKey === 'confirmed' || stepKey === 'cancelled') return 'completed';
      return 'upcoming';
    }

    if (isRejected) {
      if (['confirmed', 'dispatched', 'delivered', 'return_requested', 'return_rejected'].includes(stepKey)) {
        return 'completed';
      }
      return 'upcoming';
    }

    if (isReturnFlow) {
      if (['confirmed', 'dispatched', 'delivered'].includes(stepKey)) return 'completed';
      const stepIdx = returnSequence.indexOf(stepKey);
      if (stepIdx !== -1 && stepIdx <= currentReturnIndex) return 'completed';
      return 'upcoming';
    }

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

  const stepsToRender = isCancelled
    ? [
        { key: 'confirmed', label: 'Order Confirmed', event: 'ORDER_CONFIRMED' },
        { key: 'cancelled', label: 'Cancelled', event: 'ORDER_CANCELLED' },
      ]
    : isRejected
    ? [...standardSteps, ...rejectedReturnSteps]
    : isReturnFlow
    ? [...standardSteps, ...fullReturnSteps]
    : standardSteps;

  return (
    <div
      className="rounded-xl p-4 sm:p-5 space-y-5 font-sans themed"
      style={{
        background: 'var(--c-surface2)',
        border: '1px solid var(--c-border)',
        color: 'var(--c-text)',
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-extrabold font-display uppercase tracking-wider" style={{ color: 'var(--c-text)' }}>
          Fulfillment & Return Timeline
        </h4>
        <span
          className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg font-display"
          style={{
            background: isCancelled || isRejected ? 'var(--c-status-red-bg)' : isReturnFlow ? 'var(--c-status-amber-bg)' : 'var(--c-status-blue-bg)',
            color: isCancelled || isRejected ? 'var(--c-status-red-text)' : isReturnFlow ? 'var(--c-status-amber-text)' : 'var(--c-status-blue-text)',
            border: '1px solid var(--c-border-soft)',
          }}
        >
          Status: {currentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Steps List */}
      <div className="relative w-full overflow-x-auto pb-3 pt-1 scrollbar-none">
        <div className="flex items-start justify-between min-w-[320px] sm:min-w-full relative px-2">
          {stepsToRender.map((step, index) => {
            const state = getStepState(step.key);
            const ev = getEventForStep(step.event);
            const isCompleted = state === 'completed';
            const isCurrentTarget = normStatus === step.key;
            const isFailedStep = step.key === 'cancelled' || step.key === 'return_rejected';

            return (
              <div key={step.key} className="flex-1 relative flex flex-col items-center text-center group min-w-[75px] sm:min-w-[90px]">
                {/* Horizontal Connecting Line to Next Step */}
                {index < stepsToRender.length - 1 && (
                  <div
                    className="absolute top-[18px] sm:top-[20px] left-[50%] w-full h-[2px] -translate-y-1/2 z-0 transition-colors duration-300"
                    style={{
                      background: 'var(--c-timeline-line)',
                    }}
                  />
                )}

                {/* Circle Indicator */}
                <div
                  className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs transition-all shadow-xs"
                  style={{
                    background: isFailedStep && isCompleted
                      ? '#7f1d1d'
                      : isCompleted
                      ? 'var(--c-gold)'
                      : 'var(--c-surface)',
                    color: isFailedStep && isCompleted
                      ? 'var(--c-status-red-text)'
                      : isCompleted
                      ? '#0a0908'
                      : 'var(--c-muted)',
                    border: isCompleted ? 'none' : '1px solid var(--c-border2)',
                  }}
                >
                  {isFailedStep && isCompleted ? (
                    <span className="text-sm font-black">✕</span>
                  ) : isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>○</span>
                  )}
                </div>
                <span
                  className="mt-2 text-[11px] font-bold text-center leading-tight font-display"
                  style={{
                    color: isCurrentTarget
                      ? 'var(--c-gold)'
                      : isCompleted
                      ? 'var(--c-text)'
                      : 'var(--c-muted)',
                  }}
                >
                  {step.label}
                </span>
                {ev && (
                  <span className="text-[9px] mt-0.5 font-mono" style={{ color: 'var(--c-muted)' }}>
                    {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* History Log */}
      {timeline && timeline.length > 0 && (
        <div className="pt-3 space-y-2.5" style={{ borderTop: '1px solid var(--c-border)' }}>
          <h5 className="text-[11px] font-bold uppercase tracking-wider font-display" style={{ color: 'var(--c-gold)' }}>Activity Log</h5>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {timeline.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-2.5 rounded-lg text-xs themed"
                style={{
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                }}
              >
                <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-display" style={{ color: 'var(--c-text)' }}>{item.event_type.replace(/_/g, ' ')}</span>
                    <span
                      className="px-1.5 py-0.2 text-[9px] uppercase font-mono rounded"
                      style={{
                        background: 'var(--c-surface2)',
                        color: 'var(--c-text-dim)',
                        border: '1px solid var(--c-border)',
                      }}
                    >
                      {item.actor_role}
                    </span>
                  </div>
                  {item.description && <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>{item.description}</p>}
                </div>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--c-muted)' }}>
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
