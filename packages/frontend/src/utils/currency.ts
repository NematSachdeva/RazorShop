/**
 * Shared Currency Utility for Razor Frontend
 * 
 * Enforces the website-wide currency formatting convention using the ₹ symbol.
 * Example: 3492.22 -> "₹3,492.22"
 */

export function formatRupees(amountInRupees: number): string {
  if (isNaN(amountInRupees) || amountInRupees === null || amountInRupees === undefined) {
    return '₹0.00';
  }
  return `₹${amountInRupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCentsToRupees(cents: number): string {
  if (isNaN(cents) || cents === null || cents === undefined) {
    return '₹0.00';
  }
  return formatRupees(cents / 100);
}
