interface PaymentStatusProps {
  status: 'loading' | 'ready' | 'processing' | 'verifying' | 'complete' | 'failed' | 'cancelled';
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return 'Preparing secure payment...';
      case 'ready':
        return 'Ready for payment';
      case 'processing':
        return 'Processing payment...';
      case 'verifying':
        return 'Verifying payment...';
      case 'complete':
        return 'Payment complete!';
      case 'cancelled':
        return 'Payment cancelled. Your order remains saved.';
      case 'failed':
        return 'Payment failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusTheme = () => {
    switch (status) {
      case 'loading':
      case 'ready':
        return {
          bg: 'var(--c-status-blue-bg)',
          text: 'var(--c-status-blue-text)',
        };
      case 'processing':
      case 'verifying':
        return {
          bg: 'var(--c-status-amber-bg)',
          text: 'var(--c-status-amber-text)',
        };
      case 'complete':
        return {
          bg: 'var(--c-status-green-bg)',
          text: 'var(--c-status-green-text)',
        };
      case 'cancelled':
        return {
          bg: 'var(--c-status-amber-bg)',
          text: 'var(--c-status-amber-text)',
        };
      case 'failed':
        return {
          bg: 'var(--c-status-red-bg)',
          text: 'var(--c-status-red-text)',
        };
      default:
        return {
          bg: 'var(--c-surface2)',
          text: 'var(--c-muted)',
        };
    }
  };

  const getSpinner = () => {
    if (status === 'loading' || status === 'processing' || status === 'verifying') {
      return (
        <div className="inline-block animate-spin mr-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }
    return null;
  };

  const theme = getStatusTheme();

  return (
    <div
      className="p-4 rounded-xl border text-center font-display text-xs sm:text-sm font-semibold transition-all themed"
      style={{
        background: theme.bg,
        color: theme.text,
        borderColor: 'var(--c-border-soft)',
      }}
    >
      <div className="flex items-center justify-center gap-2">
        {getSpinner()}
        <span>{getStatusMessage()}</span>
      </div>
    </div>
  );
}

