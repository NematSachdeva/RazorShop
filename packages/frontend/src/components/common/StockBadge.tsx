interface Props {
  availableQuantity: number;
  compact?: boolean;
}

export function getStockInfo(available: number) {
  if (available <= 0) {
    return {
      status: 'out_of_stock',
      label: 'Out of stock',
      subtext: null,
      badgeColor: 'bg-gray-100 text-gray-800 border-gray-300',
      canAddToCart: false,
    };
  }
  if (available === 1) {
    return {
      status: 'critical',
      label: 'Only 1 left!',
      subtext: 'Hurry — almost sold out!',
      badgeColor: 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse',
      canAddToCart: true,
    };
  }
  if (available >= 2 && available <= 4) {
    return {
      status: 'low',
      label: `Only ${available} left`,
      subtext: 'Buy now — only a few left!',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 font-semibold',
      canAddToCart: true,
    };
  }
  if (available === 5) {
    return {
      status: 'low_5',
      label: 'Only 5 left',
      subtext: null,
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200 font-medium',
      canAddToCart: true,
    };
  }
  return {
    status: 'in_stock',
    label: 'In Stock',
    subtext: null,
    badgeColor: 'bg-green-50 text-green-700 border-green-200 font-medium',
    canAddToCart: true,
  };
}

export default function StockBadge({ availableQuantity, compact = false }: Props) {
  const info = getStockInfo(availableQuantity);

  if (compact) {
    return (
      <span className={`inline-block px-2 py-0.5 text-xs rounded border ${info.badgeColor}`}>
        {info.label}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <span className={`inline-block px-2.5 py-1 text-xs rounded-md border ${info.badgeColor}`}>
        {info.label}
      </span>
      {info.subtext && (
        <p className="text-xs text-amber-700 font-medium italic">{info.subtext}</p>
      )}
    </div>
  );
}
