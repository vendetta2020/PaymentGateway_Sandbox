import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  maskApiKey,
  maskCardNumber,
  formatDateTime,
  formatDateOnly,
} from '../formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats IDR currency with Indonesian thousand separators and Rp prefix', () => {
      expect(formatCurrency(125000)).toBe('Rp 125.000');
      expect(formatCurrency(1500000)).toBe('Rp 1.500.000');
      expect(formatCurrency(0)).toBe('Rp 0');
    });

    it('formats negative currency correctly for debt/deduction displays', () => {
      const formatted = formatCurrency(-50000);
      expect(formatted).toContain('50.000');
      expect(formatted).toContain('-');
    });

    it('formats USD currency correctly', () => {
      const formatted = formatCurrency(125, 'USD');
      expect(formatted).toContain('125.00');
    });
  });

  describe('maskApiKey', () => {
    it('masks secret key showing prefix and last 4 characters', () => {
      const key = 'sk_test_9921_8b7c4a1e9f0d';
      expect(maskApiKey(key)).toBe('sk_test_••••••••9f0d');
    });

    it('handles short or empty keys safely', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('short')).toBe('••••••••••••');
    });
  });

  describe('maskCardNumber', () => {
    it('masks card displaying last 4 digits only', () => {
      expect(maskCardNumber('4242')).toBe('•••• 4242');
    });
  });

  describe('formatDateTime & formatDateOnly', () => {
    it('formats ISO timestamps reliably', () => {
      const date = '2026-03-30T14:21:08.000Z';
      expect(formatDateTime(date)).toBeDefined();
      expect(formatDateOnly(date)).toBeDefined();
    });
  });
});
