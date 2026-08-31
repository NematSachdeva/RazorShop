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
    <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-4 sm:p-5 space-y-5 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
          Fulfillment & Return Timeline
        </h4>
        <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg border ${
          isCancelled || isRejected
            ? 'bg-rose-100 text-rose-800 border-rose-200'
            : isReturnFlow
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-blue-100 text-blue-800 border-blue-200'
        }`}>
          Status: {currentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Steps List */}
      <div className="relative w-full overflow-x-auto pb-3 pt-1">
        <div className="flex items-start justify-between min-w-[320px] sm:min-w-full relative px-2">
          {stepsToRender.map((step, index) => {
            const state = getStepState(step.key);
            const ev = getEventForStep(step.event);
            const isCompleted = state === 'completed';
            const isCurrentTarget = normStatus === step.key;
            const isFailedStep = step.key === 'cancelled' || step.key === 'return_rejected';

            const nextStep = stepsToRender[index + 1];
            const nextState = nextStep ? getStepState(nextStep.key) : null;
            const isNextFailed = nextStep && (nextStep.key === 'cancelled' || nextStep.key === 'return_rejected');
            const isLineActive = isCompleted && nextState === 'completed';

            return (
              <div key={step.key} className="flex-1 relative flex flex-col items-center text-center group min-w-[75px] sm:min-w-[90px]">
                {/* Horizontal Connecting Line to Next Step */}
                {index < stepsToRender.length - 1 && (
                  <div
                    className={`absolute top-[18px] sm:top-[20px] left-[50%] w-full h-[3px] -translate-y-1/2 z-0 transition-colors duration-300 ${
                      isLineActive
                        ? isNextFailed
                          ? 'bg-rose-600'
                          : 'bg-blue-600'
                        : 'bg-gray-200'
                    }`}
                  />
                )}

                {/* Circle Indicator */}
                <div
                  className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs transition-all shadow-sm ${
                    isFailedStep && isCompleted
                      ? 'bg-rose-600 text-white ring-4 ring-rose-100'
                      : isCompleted
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                      : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}
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
                  className={`mt-2 text-[11px] font-bold text-center leading-tight ${
                    isCurrentTarget
                      ? 'text-blue-700 font-black'
                      : isCompleted
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {ev && (
                  <span className="text-[9px] text-gray-500 mt-0.5 font-mono">
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
        <div className="pt-3 border-t border-gray-200/80 space-y-2.5">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Activity Log</h5>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
