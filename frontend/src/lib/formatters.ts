/**
 * Financial and presentation formatting utilities.
 *
 * NON-CALCULATION INVARIANT:
 * The frontend never calculates financial sums, fees, or remaining balances independently.
 * It only formats values received from the authoritative backend for presentation.
 */

/**
 * Format an integer currency amount (in smallest unit or standard unit) for display.
 * Default currency is IDR ('Rp 125.000').
 */
export function formatCurrency(
  amount: number,
  currency: string = 'IDR',
): string {
  if (currency.toUpperCase() === 'IDR') {
    // In IDR, amounts are typically whole integer rupiahs
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
    // Replace non-breaking spaces with standard space for visual consistency: 'Rp 125.000'
    return formatted.replace(/\u00a0/g, ' ');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Format ISO timestamp into a readable date and time string.
 */
export function formatDateTime(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format date only (e.g., 'Jan 10, 2026').
 */
export function formatDateOnly(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Mask sensitive API key secrets (e.g., 'sk_test_••••••••3f8a').
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return '••••••••••••';
  const prefix = key.slice(0, 8); // e.g. 'sk_test_'
  const suffix = key.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Mask card numbers (e.g., '•••• 4242').
 */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`;
}
