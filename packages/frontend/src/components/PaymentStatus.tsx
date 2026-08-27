interface PaymentStatusProps {
  status: 'loading' | 'ready' | 'processing' | 'verifying' | 'complete' | 'failed';
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return 'Initializing payment...';
      case 'ready':
        return 'Ready for payment';
      case 'processing':
        return 'Processing payment...';
      case 'verifying':
        return 'Verifying payment...';
      case 'complete':
        return 'Payment complete!';
      case 'failed':
        return 'Payment failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'ready':
        return 'text-blue-600';
      case 'processing':
        return 'text-yellow-600';
      case 'verifying':
        return 'text-yellow-600';
      case 'complete':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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

  return (
    <div className={`p-4 rounded-lg border mb-6 text-center ${getStatusColor()} border-current border-opacity-20`}>
      <p className={`${getStatusColor()} font-medium`}>
        {getSpinner()}
        {getStatusMessage()}
      </p>
    </div>
  );
}
